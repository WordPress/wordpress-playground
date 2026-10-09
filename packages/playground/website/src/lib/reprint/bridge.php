<?php
/**
 * Calls Reprint's PHP API from Playground and adds browser-specific setup.
 *
 * ImportClient::run() is the command dispatcher used by Reprint's CLI. We call
 * it directly because the CLI entry point requires PHP_SAPI === 'cli', whereas
 * Playground runs PHP in WebAssembly. Reprint handles indexing, downloading,
 * mirror deletions, progress, and download checkpoints. This bridge supplies
 * Playground's paths, exclusions, size limit, and linked-file copying.
 *
 * The private key is supplied in the process environment, not a connection
 * setting or a generated script. Its temporary file stays outside the site directory
 * and exports. Downloaded site data can still contain private data.
 */
ini_set('max_execution_time', '0');
if (!defined('STDOUT')) define('STDOUT', fopen('php://output', 'wb'));
if (!defined('STDERR')) define('STDERR', fopen('php://stderr', 'wb'));
require 'phar:///tmp/playground-reprint.phar/packages/reprint-client/src/import.php';

use function WordPress\Filesystem\wp_join_unix_paths;
use WordPress\Reprint\Server\Utils;

/**
 * Adds the browser's combined 2 GiB limit to Reprint's file and SQL commands.
 *
 * Reprint v0.10.13 has no option to cap the selected file bytes. This subclass
 * checks the completed file index before destructive work and checks SQL bytes
 * before each chunk is written. File downloads and their progress still use
 * ImportClient unchanged; SQL progress includes written bytes and table counts.
 * Remove these guards when Reprint exposes the limits as command options.
 */
class PlaygroundReprintClient extends ImportClient {
    private const MAX_SITE_BYTES = 2 * 1024 * 1024 * 1024;
    private ?int $site_file_bytes = null;
    private float $last_byte_update = 0;
    /** Table counters from Reprint's last SQL download record, shown beside byte counts. */
    private array $sql_tables = [];

    /**
     * Uses Reprint's stage reports to stop an oversized pull before changes.
     *
     * The selected index is ready when Reprint announces diff, mirror, or fetch.
     * Checking all three also covers resumed commands that skip earlier stages.
     * Reprint has no separate before-mirror callback, so this override checks
     * the size here and leaves file progress output to the parent method. SQL
     * records are adapted to the browser's byte/table and import-offset fields;
     * SQL import yields briefly so the page receives updates while it runs.
     */
    public function output_progress(array $data, bool $force = false): void {
        if (($data['command'] ?? '') === 'files-pull' && ($data['event'] ?? '') === 'stage'
            && in_array($data['stage'] ?? '', ['diff', 'mirror', 'fetch'], true)) {
            // The mapped index is complete and filtered here. Check before the
            // diff can delete local files or fetch their replacements, including
            // when Reprint resumes directly at a later stage.
            $this->assert_site_size();
        }
        if (($data['command'] ?? '') === 'db-pull' && is_array($data['progress'] ?? null)) {
            // Reprint reports which table it is on and, per table, an estimated
            // row count. The SQL dump has no byte total, so this is the "of"
            // the download can offer.
            $progress = $data['progress'];
            $table = $progress['current_table'] ?? null;
            $this->sql_tables = array_filter([
                'tablesDone' => $progress['items']['done'] ?? null,
                'tablesTotal' => $progress['items']['total'] ?? null,
                'tableName' => $table['name'] ?? null,
                'rowsDone' => $table['rows_done'] ?? null,
                'rowsTotal' => $table['rows_total'] ?? null,
            ], fn($value) => $value !== null);
            $this->emit_sql_progress(true);
            return;
        }
        if (($data['phase'] ?? '') === 'db-apply' && isset($data['bytes_read'])) {
            if ($force || microtime(true) - $this->last_byte_update >= 0.1) {
                $this->last_byte_update = microtime(true);
                echo json_encode(['playgroundProgress' => [
                    'phase' => 'db-apply',
                    'message' => 'Importing SQL',
                    'bytesDone' => $data['bytes_read'],
                    'bytesTotal' => $data['bytes_total'],
                    'statementsDone' => $data['statements_executed'] ?? null,
                ]], JSON_THROW_ON_ERROR) . "\n";
                // SQL runs on the PHP worker without network waits. Yield so its
                // output reaches the page before the entire import finishes.
                usleep(1);
            }
            return;
        }
        parent::output_progress($data, $force);
    }

    /**
     * Checks incoming SQL against the combined file-and-SQL size limit.
     *
     * Reprint writes the SQL dump and tracks its resume position. It has no
     * option to cap that dump before each chunk is written, so wrap its SQL
     * callback to check the bytes first. File downloads still use Reprint's
     * unchanged writer and native progress. Restore the callback on failure.
     */
    protected function fetch_streaming(string $url, \Reprint\Importer\StreamingContext $context, ?array $post_data = null, ?string $endpoint = null): void {
        if ($endpoint !== 'sql_chunk') {
            parent::fetch_streaming($url, $context, $post_data, $endpoint);
            return;
        }
        $sql_path = wp_join_unix_paths($this->state_dir, 'db.sql');
        $on_chunk = $context->on_chunk;
        $context->on_chunk = function (array $chunk) use ($on_chunk, $sql_path): void {
            if (($chunk['headers']['x-chunk-type'] ?? '') === 'sql') {
                clearstatcache(true, $sql_path);
                $this->assert_site_size(filesize($sql_path) + strlen($chunk['body'] ?? ''));
            }
            $on_chunk($chunk);
            $this->emit_sql_progress();
        };
        try {
            $this->emit_sql_progress(true);
            parent::fetch_streaming($url, $context, $post_data, $endpoint);
        } finally {
            $context->on_chunk = $on_chunk;
            $this->emit_sql_progress(true);
        }
    }

    /**
     * Reports written SQL bytes beside Reprint's table and row counters.
     *
     * Reprint's table-size estimate is not the SQL dump size. Read the actual
     * dump length, including resumed batches, without inventing a byte total.
     * Check the size limit on every chunk even when UI updates are throttled.
     */
    private function emit_sql_progress(bool $force = false): void {
        // Measure the written SQL, including resumed batches. Remote table sizes
        // do not measure SQL dump bytes, so they cannot supply a denominator.
        $sql_path = wp_join_unix_paths($this->state_dir, 'db.sql');
        clearstatcache(true, $sql_path);
        $done = is_file($sql_path) ? filesize($sql_path) : 0;
        // Check every chunk, not only the throttled UI updates. This also counts
        // SQL retained on retry and the checkpoint markers added by Reprint.
        $this->assert_site_size($done);
        if (!$force && microtime(true) - $this->last_byte_update < 0.25) return;
        $this->last_byte_update = microtime(true);
        echo json_encode(['playgroundProgress' => [
            'phase' => 'db-pull',
            'message' => 'Downloading SQL',
            'bytesDone' => $done,
        ] + $this->sql_tables], JSON_THROW_ON_ERROR) . "\n";
    }

    /**
     * Counts the whole selected site, not just this pull's changed files.
     *
     * A repeat pull of a 3 GiB site may download only 1 KiB; it must still exceed
     * the browser limit. Read Reprint's mapped, filtered index one line at a time
     * and cache the accepted total for later stage reports in this PHP call.
     * Add written SQL bytes to the same budget, including SQL retained on retry.
     */
    private function assert_site_size(int $sql_bytes = 0): void {
        $file_bytes = $this->site_file_bytes;
        if ($file_bytes === null) {
            // Use the full selected index, not the incremental fetch list. The
            // mapped index includes followed targets and omits excluded paths.
            $index = fopen(wp_join_unix_paths($this->pull_state_directory, 'remote-index.local-map.jsonl'), 'rb');
            if ($index === false) throw new RuntimeException('Could not read the site size from the Reprint file index.');
            $file_bytes = 0;
            try {
                while (($line = fgets($index)) !== false) {
                    $entry = MappedRemoteIndexBuilder::decode_index_line($line);
                    if ($entry['type'] !== 'file') continue;
                    $file_bytes += max(0, $entry['size']);
                    if ($file_bytes > self::MAX_SITE_BYTES) break;
                }
            } finally {
                fclose($index);
            }
        }
        if ($file_bytes + $sql_bytes > self::MAX_SITE_BYTES) {
            throw new RuntimeException('This site exceeds Playground’s 2 GiB import limit (site files plus SQL). Use the Reprint CLI to pull this site locally.');
        }
        $this->site_file_bytes = $file_bytes;
    }
}

if (getenv('PLAYGROUND_REPRINT') !== false) {
    run_transfer();
}

/**
 * Bridges a JavaScript request to one locked Playground pull step.
 *
 * Reprint's CLI reads argv and reports command results. Playground passes JSON
 * through the PHP environment and needs a JSON result telling it which step to
 * run next. Use ReprintProcessLock and the client API for the transfer, then
 * save the bridge's next step. Reprint keeps its own download checkpoints.
 * Convert PHP warnings to failures so JavaScript can report them rather than
 * waiting for a result that never arrives.
 */
function run_transfer(): void {
    set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
        if (!(error_reporting() & $severity)) return false;
        throw new ErrorException($message, 0, $severity, $file, $line);
    });
    try {
        $request = json_decode(getenv('PLAYGROUND_REPRINT'), true, 512, JSON_THROW_ON_ERROR);
        putenv('PLAYGROUND_REPRINT');
        // Transfer state lives in memory for the length of the session. A pull
        // that loses it (reload, crash) starts over rather than restoring a
        // checkpoint: the site is temporary until the pull completes anyway.
        $root = wp_join_unix_paths('/tmp/playground-reprint-state', md5($request['documentRoot'] . "\n" . $request['url']));
        if (!is_dir($root)) mkdir($root, 0700, true);
        $lock = new ReprintProcessLock($root);
        // Reprint's public API accepts a key-file path. Keep that file in /tmp,
        // never in the mirrored WordPress tree or the saved site's exports.
        $request['privateKeyPath'] = wp_join_unix_paths($root, 'key.pem');
        file_put_contents($request['privateKeyPath'], $request['privateKey']);
        chmod($request['privateKeyPath'], 0600);
        unset($request['privateKey']);
        $operation_path = wp_join_unix_paths($root, 'operation.json');
        $operation = is_file($operation_path) ? json_decode(file_get_contents($operation_path), true, 512, JSON_THROW_ON_ERROR) : null;
        if (!in_array($request['command'], ['pull', 'finish-pull'], true)) {
            throw new RuntimeException('Unknown pull command.');
        }
        if (!$operation) {
            if ($request['command'] === 'finish-pull') {
                throw new RuntimeException('There is no pull to finish.');
            }
            $operation = ['stage' => 'preflight'];
            save_operation($operation_path, $operation);
        }
        if ($operation['stage'] === 'preflight') {
            $result = connect_site($request, $root, $operation, $lock);
        } else {
            $result = pull_site($request, $root, $operation, $lock);
        }
        // WordPress starts running imported plugins during login. Remove the key
        // before that, not just at final completion. A retry supplies it again.
        if (in_array($result['status'], ['install', 'complete'], true)) {
            unlink($request['privateKeyPath']);
        }
        if ($result['status'] === 'complete') {
            unlink($operation_path);
        } else {
            save_operation($operation_path, $operation);
        }
        echo json_encode(['playgroundReprint' => $result], JSON_THROW_ON_ERROR) . "\n";
    } catch (Throwable $error) {
        fwrite(STDERR, $error->getMessage() . "\n");
        exit(1);
    } finally {
        restore_error_handler();
        if (isset($lock)) {
            $lock->close();
        }
    }
}

/**
 * Learns the live site's folder layout before choosing Playground destinations.
 *
 * Run Reprint's public preflight command and prepare_files_pull_options() API;
 * do not repeat their server checks or selector validation. Reprint also offers
 * pull-files, which runs preflight and files-pull together. We split those calls
 * because the remap rules depend on the paths returned by preflight, and must
 * be checked before mirroring. Save those rules for the following PHP calls.
 * On a fresh pull, reset command cursors but keep the previous remote index
 * so Reprint can download only changes.
 */
function connect_site(array $request, string $root, array &$operation, ReprintProcessLock $lock): array {
    $state = wp_join_unix_paths($root, 'pull-state');
    $files = $request['documentRoot'];
    $client = new ImportClient($request['url'], $state, $files, ['allow_http' => is_local_reprint_url($request['url'])]);
    // Reprint now returns from preflight instead of exiting PHP. Save its
    // metadata here, before advancing the operation or emitting the next stage.
    $client->run(['command' => 'preflight', 'private_key_path' => $request['privateKeyPath'], 'progress' => 'jsonl'], $lock);
    $error = $client->get_preflight_error();
    if ($error !== null) throw new RuntimeException($error['message']);
    $preflight = $client->get_state()->preflight_record()['data'];
    $metadata = source_metadata($preflight);
    $metadata['routeHandlers'] = host_route_handlers($preflight);
    // A fresh pull compares against the last remote index. Reset
    // command cursors, not that index or the downloaded site files.
    // run(preflight) above loads the saved mapping fingerprints; the client
    // constructor alone starts with blank state and must not reset it.
    $client->clear_files_pull_progress();
    foreach (['progress.json', 'db.sql', 'db-session-setup.sql', 'db-tables.jsonl', 'import.sqlite', 'import.sqlite-wal', 'import.sqlite-shm', 'import.sqlite-journal'] as $file) {
        remove_tree(wp_join_unix_paths($state, $file));
    }
    $metadata['pullMappings'] = pull_path_mappings($metadata);
    // Resolve and validate every selector before file mirroring starts.
    $client->prepare_files_pull_options([
        'include' => [':abspath:', ':wp-content:'],
        'exclude' => pull_exclusions(),
        'remap' => $metadata['pullMappings'],
    ], false);
    file_put_contents(wp_join_unix_paths($root, 'source.json'), json_encode($metadata, JSON_THROW_ON_ERROR));
    $operation['stage'] = 'files-pull';
    return ['status' => 'continue', 'stage' => $operation['stage']];
}

/**
 * Runs Reprint's file and SQL commands, then configures the local site.
 *
 * ImportClient::run() already indexes, downloads, removes remote-absent local
 * paths inside today's pull selection, and resumes unfinished downloads. This
 * function supplies Playground's options and adds a files-prepare step because
 * Reprint's follow_symlinks option downloads link targets but keeps the links.
 * Playground's OPFS save/restore layer does not preserve symbolic links yet.
 * Copy their targets into ordinary files as a Playground workaround. If only
 * that setup fails, retry setup without repeating a completed download.
 *
 * Run Reprint's db-pull and db-apply commands into a separate SQLite file so
 * WordPress cannot see half-imported tables. Once they finish, install that
 * database and write the local configuration. Return install so JavaScript
 * can verify administrator login before it sends finish-pull.
 */
function pull_site(array $request, string $root, array &$operation, ReprintProcessLock $lock): array {
    $files = $request['documentRoot'];
    $state = wp_join_unix_paths($root, 'pull-state');
    if ($operation['stage'] === 'install') {
        if ($request['command'] !== 'finish-pull') {
            return ['status' => 'install'];
        }
        // The imported SQL dump is disposable once applied.
        remove_tree(wp_join_unix_paths($state, 'db.sql'));
        return ['status' => 'complete'];
    }
    $stages = ['files-pull', 'files-prepare', 'db-pull', 'db-apply', 'configure'];
    $stage = $operation['stage'];
    if ($stage === 'configure') {
        $metadata = json_decode(file_get_contents(wp_join_unix_paths($root, 'source.json')), true, 512, JSON_THROW_ON_ERROR);
        // Only the database needs a separate destination while importing. A
        // failed SQL import must not expose half-written tables to WordPress.
        $database = $request['databasePath'];
        if (!is_dir(dirname($database))) mkdir(dirname($database), 0700, true);
        if (is_file($state . '/import.sqlite')) {
            foreach (['', '-wal', '-shm', '-journal'] as $suffix) remove_tree($database . $suffix);
            if (!rename($state . '/import.sqlite', $database)) {
                throw new RuntimeException('Could not install the imported database.');
            }
        }
        // Hosts such as WP Cloud answer some URLs in their web server rather
        // than from files: thumbnails are resized from the original on request.
        // Reprint expresses those rules as PHP; running it from wp-config.php
        // covers them here, since Playground routes missing files to index.php.
        $runtime = wp_join_unix_paths($files, '.playground-reprint', 'runtime.php');
        $handlers = $metadata['routeHandlers'] ?? '';
        if ($handlers !== '') {
            if (!is_dir(dirname($runtime))) mkdir(dirname($runtime), 0700, true);
            file_put_contents($runtime, "<?php\n// Generated by Playground from Reprint's host rules. Do not edit.\n"
                . "if (!defined('WP_CONTENT_DIR')) define('WP_CONTENT_DIR', dirname(__DIR__) . '/wp-content');\n"
                . $handlers);
        } else {
            remove_tree($runtime);
        }
        $config = "<?php\n";
        // The local copy must log failures even when the production config
        // disabled debugging. Do not print notices into pages or login headers.
        foreach (['DB_NAME' => 'wordpress', 'DB_USER' => 'root', 'DB_PASSWORD' => '', 'DB_HOST' => 'localhost', 'WP_DEBUG' => true, 'WP_DEBUG_LOG' => true, 'WP_DEBUG_DISPLAY' => false, 'WP_HOME' => $request['siteUrl'], 'WP_SITEURL' => $request['siteUrl']] as $name => $value) {
            $config .= 'if (!defined(' . var_export($name, true) . ')) define(' . var_export($name, true) . ', ' . var_export($value, true) . ");\n";
        }
        $config .= '$table_prefix = ';
        $config .= var_export($metadata['tablePrefix'], true) . ";\n";
        if ($handlers !== '') {
            $config .= "if (is_file(__DIR__ . '/.playground-reprint/runtime.php')) require_once __DIR__ . '/.playground-reprint/runtime.php';\n";
        }
        $config .= "if (!defined('ABSPATH')) define('ABSPATH', __DIR__ . '/');\nrequire_once ABSPATH . 'wp-settings.php';\n";
        file_put_contents(wp_join_unix_paths($files, 'wp-config.php'), $config);
        $operation['stage'] = 'install';
        return ['status' => 'install'];
    }
    $metadata = json_decode(file_get_contents(wp_join_unix_paths($root, 'source.json')), true, 512, JSON_THROW_ON_ERROR);
    $client = new PlaygroundReprintClient($request['url'], $state, $files, ['allow_http' => is_local_reprint_url($request['url'])]);
    // Older transfers can have completed Reprint's download before the adapter
    // failed. Keep those bytes and proceed to local setup without another pull.
    $progress_path = wp_join_unix_paths($state, 'progress.json');
    $progress = is_file($progress_path) ? json_decode(file_get_contents($progress_path), true, 512, JSON_THROW_ON_ERROR) : [];
    if ($stage === 'files-pull' && ($progress['command'] ?? null) === 'files-pull' && ($progress['status'] ?? null) === 'complete') {
        save_pulled_links($files, $root, $metadata, $client);
        $operation['stage'] = 'files-prepare';
        return ['status' => 'continue', 'stage' => $operation['stage']];
    }
    if ($stage === 'files-prepare') {
        echo json_encode(['playgroundProgress' => ['phase' => $stage, 'message' => 'Setting up downloaded files…']]) . "\n";
        restore_pulled_links($root);
        materialize_site_links($files, $files, wp_join_unix_paths($root, 'linked-copy'));
        $operation['stage'] = 'db-pull';
        return ['status' => 'continue', 'stage' => $operation['stage']];
    }
    $client->run([
        'command' => $stage,
        'private_key_path' => $request['privateKeyPath'],
        'progress' => 'jsonl',
        // Reprint also selects detached plugins, MU plugins, and uploads when
        // wp-content is selected. Map them into the Playground's local layout.
        'include' => [':abspath:', ':wp-content:'],
        'exclude' => pull_exclusions(),
        'files_pull_mode' => 'mirror',
        'remap' => $metadata['pullMappings'] ?? pull_path_mappings($metadata),
        'include_host_plugins' => false,
        'follow_symlinks' => true,
        'local_followed_symlinks_root' => ':fs-root:/wp-content/.reprint-linked-files',
        'target_engine' => 'sqlite',
        'target_sqlite_path' => wp_join_unix_paths($state, 'import.sqlite'),
        'new_site_url' => $request['siteUrl'],
    ], $lock);
    if ($client->exit_code !== 0 && $client->exit_code !== 2) {
        throw new RuntimeException('Reprint stopped. Check the transfer error and retry with the same site and key.');
    }
    if ($client->exit_code === 0) {
        if ($stage === 'files-pull') save_pulled_links($files, $root, $metadata, $client);
        $operation['stage'] = $stages[array_search($stage, $stages, true) + 1];
    }
    return ['status' => 'continue', 'stage' => $operation['stage']];
}

/**
 * Chooses remap rules that fit a live site's folders into Playground's layout.
 *
 * Reprint's remap option performs the mapping; it cannot choose which local
 * layout this application needs. For example, map an active /srv/content to
 * /wordpress/wp-content. Put a separate bundled core/wp-content elsewhere so
 * both copies cannot write wp-content/index.php. Reprint's flat-docroot command
 * builds a standard layout with symbolic links. Playground's OPFS save/restore
 * layer does not preserve those links yet, so choose final download paths before
 * files-pull instead.
 */
function pull_path_mappings(array $metadata): array {
    $paths = $metadata['paths'];
    $core = rtrim($paths['abspath'] ?? '', '/');
    $content = rtrim($paths['content_dir'] ?? '', '/');
    if ($core === '' || $content === '') {
        throw new RuntimeException('Reprint did not report the WordPress and content directories. Check its preflight report before retrying.');
    }
    // Reprint reports a directory that does not exist yet (a site without
    // mu-plugins, say) as false, not null.
    $directory = fn($reported, string $fallback) => is_string($reported) && $reported !== ''
        ? rtrim($reported, '/')
        : $fallback;
    $directories = [
        [$core, ':fs-root:'],
        [$content, ':fs-root:/wp-content'],
        [$directory($paths['plugins_dir'] ?? null, $content . '/plugins'), ':fs-root:/wp-content/plugins'],
        [$directory($paths['mu_plugins_dir'] ?? null, $content . '/mu-plugins'), ':fs-root:/wp-content/mu-plugins'],
        [$directory($paths['uploads']['basedir'] ?? null, $content . '/uploads'), ':fs-root:/wp-content/uploads'],
    ];
    $mappings = [];
    foreach ($directories as [$source, $target]) {
        if (isset($mappings[$source]) && $mappings[$source] !== $target) {
            throw new RuntimeException('Reprint reports the same directory for different WordPress folders: ' . $source);
        }
        $mappings[$source] = $target;
    }
    foreach ($directories as [$source, $target]) {
        foreach ($directories as [$parent_source, $parent_target]) {
            if (!str_starts_with($target, $parent_target . '/')) continue;
            $bundled = $parent_source . substr($target, strlen($parent_target));
            if (isset($mappings[$bundled])) continue;
            // For example: core/wp-content and the active /srv/content must not
            // both write wp-content/index.php. Keep bundled copies at distinct
            // paths, including when the active directory is nested inside one.
            $mappings[$bundled] = ':fs-root:/.reprint-source-files' . $bundled;
        }
    }
    $result = [];
    foreach ($mappings as $source => $target) $result[] = [$source, $target];
    return $result;
}

/**
 * Lists the Playground files that the current pull must leave untouched.
 *
 * Reprint's exclude option enforces these rules for both writes and mirror
 * deletions. Playground must choose the rules: the live site's wp-config.php
 * cannot replace its SQLite setup, and host cache drop-ins cannot run here.
 * Share the same list with linked-file copying so setup cannot bypass it.
 */
function pull_exclusions(): array {
    // Production credentials, host-specific paths, and server configuration
    // must not become the Playground runtime configuration. Preserve the local
    // runtime and database while Reprint mirrors site files.
    // Exclusions apply to both incoming writes and mirror deletions.
    return [
        // These describe the saved Playground, not the WordPress site. Removing
        // wp-runtime.json makes a reload create a fresh site under the same slug.
        ':abspath:/wp-runtime.json', ':abspath:/blueprint-bundle',
        ':abspath:/.playground-reprint',
        ':abspath:/wp-config.php', ':abspath:/.htaccess', ':abspath:/.user.ini', ':abspath:/php.ini',
        ':wp-content:/database', ':wp-content:/db.php',
        ':wp-content:/object-cache.php', ':wp-content:/advanced-cache.php',
        ':wp-mu-plugins:/sqlite-database-integration', ':wp-mu-plugins:/playground-includes',
        ':wp-mu-plugins:/0-playground.php', ':wp-mu-plugins:/0-sqlite.php',
    ];
}

/**
 * Records selected links and their mapped targets for the later setup call.
 *
 * A fetched theme link can use a relative path through a remote host alias,
 * while Reprint's index names its canonical target. Read that index and use
 * Reprint's RemoteToLocalPathMapper and Utils::resolve_symlink_target_path()
 * to find the downloaded target; do not invent another path mapper. Save the
 * pairs in links.json so setup can also restore link nodes that Playground's
 * OPFS save/restore layer does not preserve yet.
 */
function save_pulled_links(string $files, string $root, array $metadata, PlaygroundReprintClient $client): void {
    $mappings = [];
    foreach ($metadata['pullMappings'] ?? pull_path_mappings($metadata) as [$source, $target]) {
        $mappings[$source] = str_replace(':fs-root:', $files, $target);
    }
    $format = $client->get_state()->remote_path_format();
    $mapper = new RemoteToLocalPathMapper(
        $files, $format, [$metadata['paths']['abspath'], $metadata['paths']['content_dir']],
        $mappings, wp_join_unix_paths($files, 'wp-content/.reprint-linked-files')
    );
    $excluded = str_replace(
        [':abspath:', ':wp-content:', ':wp-mu-plugins:'],
        [$files, $files . '/wp-content', $files . '/wp-content/mu-plugins'],
        pull_exclusions()
    );
    $index = fopen(wp_join_unix_paths($client->pull_state_directory, 'remote-index.next.jsonl'), 'rb');
    $links = [];
    try {
        while (($line = fgets($index)) !== false) {
            $entry = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
            // Intermediate aliases serve the remote host's layout. The index's
            // canonical targets let us bypass those aliases in the local copy.
            if (($entry['type'] ?? '') !== 'link' || !empty($entry['intermediate'])) continue;
            $remote = base64_decode($entry['path'], true);
            $path = $mapper->remote_path_to_local_path($remote);
            if (!is_link($path) || Utils::path_is_same_as_or_descendant_of($path, $excluded)) continue;
            // The fetch stream can send a relative target through a host alias
            // (e.g. /srv/wordpress), while the index names /wordpress/themes/….
            // Map the indexed target, not that host-specific relative spelling.
            $target = Utils::resolve_symlink_target_path($remote, base64_decode($entry['target'], true), $format);
            $links[] = ['path' => $path, 'target' => $mapper->remote_path_to_local_path($target)];
        }
    } finally {
        fclose($index);
    }
    file_put_contents(wp_join_unix_paths($root, 'links.json'), json_encode($links, JSON_THROW_ON_ERROR));
}

/**
 * Points saved links at their downloaded targets before copying their bytes.
 *
 * Reprint has already finished files-pull. Its fetched relative links may need
 * the mapped canonical targets saved in links.json. Playground's OPFS
 * save/restore layer also does not preserve link nodes yet. Rebuild only the
 * saved links instead of rerunning the download. On a setup retry, leave paths
 * already replaced by ordinary files alone. Report a missing target rather
 * than silently losing a theme or plugin.
 */
function restore_pulled_links(string $root): void {
    $links = json_decode(file_get_contents(wp_join_unix_paths($root, 'links.json')), true, 512, JSON_THROW_ON_ERROR);
    foreach ($links as $link) {
        $path = $link['path'];
        $target = $link['target'];
        if (!is_link($path) && file_exists($path)) continue; // Already materialized before a setup failure.
        if (is_link($path)) unlink($path);
        if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
        if (!symlink($target, $path)) throw new RuntimeException('Could not restore downloaded link: ' . $path . ' -> ' . $target);
    }
    foreach ($links as $link) {
        if (is_link($link['path']) && !file_exists($link['path'])) {
            throw new RuntimeException('Downloaded link target is missing: ' . $link['path'] . ' -> ' . $link['target'] . '. Local setup stopped; the downloaded files are retained.');
        }
    }
}

/**
 * Replaces downloaded links with ordinary files for Playground's OPFS storage.
 *
 * A link such as wp-content/themes/iotix can point to valid downloaded theme
 * bytes. Reprint can download these targets and keep the links, and Playground's
 * running PHP filesystem supports them. The gap is Playground's OPFS save/restore
 * layer: it does not preserve symbolic links. Keep this copy workaround until
 * Playground can save and restore them. Copy each target to a temporary path
 * before replacing its link, leaving ordinary downloaded files and protected
 * runtime paths alone.
 */
function materialize_site_links(string $path, string $document_root, string $temporary): void {
    $local_exclusions = str_replace(
        [':abspath:', ':wp-content:', ':wp-mu-plugins:'],
        [$document_root, $document_root . '/wp-content', $document_root . '/wp-content/mu-plugins'],
        pull_exclusions()
    );
    // Followed packages already have canonical files here. Copying their host
    // aliases too would duplicate entire plugin/theme trees a second time.
    $local_exclusions[] = wp_join_unix_paths($document_root, 'wp-content/.reprint-linked-files');
    if (in_array($path, $local_exclusions, true)) return;
    if (is_link($path)) {
        // Playground's OPFS save/restore does not preserve symlinks yet. Copy
        // only linked content; ordinary downloads already sit at their final path.
        remove_tree($temporary);
        sync_tree($path, $temporary, [realpath($document_root)]);
        unlink($path);
        if (!rename($temporary, $path)) throw new RuntimeException('Could not install linked content: ' . $path);
    } elseif (is_dir($path)) {
        foreach (array_diff(scandir($path), ['.', '..']) as $name) {
            materialize_site_links(wp_join_unix_paths($path, $name), $document_root, $temporary);
        }
    }
}

/**
 * Gets Reprint's PHP handlers for routes served by the live site's web server.
 *
 * Playground has no copy of that web server. Use runtime_manifest_for() and
 * generate_route_handler_code() rather than duplicating Reprint's host rules,
 * then load the handlers from local wp-config.php. Host detection is advisory:
 * keep the imported site even if no handlers can be generated.
 */
function host_route_handlers(array $preflight): string {
    try {
        return generate_route_handler_code(runtime_manifest_for($preflight));
    } catch (Throwable $error) {
        // Host detection is advisory. A pull must not fail on it.
        fwrite(STDERR, 'Skipping host request rules: ' . $error->getMessage() . "\n");
        return '';
    }
}

/**
 * Extracts the preflight fields kept in the bridge's source.json record.
 *
 * Reprint already detected WordPress and returned this report. This helper
 * only adapts that report to the fields used by the bridge: folder paths for
 * file mapping, plus the table prefix for SQL import.
 * It makes no further request to the live site.
 */
function source_metadata(array $data): array {
    $prefix = $data['database']['wp']['table_prefix'] ?? null;
    if (!is_string($prefix) || !preg_match('/^[a-zA-Z0-9_]+$/', $prefix)) {
        throw new RuntimeException('The source did not report a valid WordPress table prefix.');
    }
    $paths = $data['database']['wp']['paths_urls'] ?? [];
    $paths['abspath'] ??= $data['wp_detect']['roots'][0]['path'] ?? null;
    return [
        'tablePrefix' => $prefix,
        'documentRoot' => $data['runtime']['document_root'] ?? null,
        'paths' => $paths,
    ];
}

/**
 * Copies a link target as ordinary files for materialize_site_links().
 *
 * Playground's OPFS persistence currently needs ordinary files in place of
 * links. PHP's copy() copies one file, so this workaround walks directories too.
 * It follows only targets inside the downloaded roots and rejects directory
 * loops. Without those checks, a linked theme could copy unrelated local files
 * or recurse forever.
 * Track the current branch rather than all visited paths so two aliases of
 * the same theme can both be copied.
 */
function sync_tree(string $source, string $target, array $allowed_roots, array $ancestors = []): void {
    if (is_link($source)) {
        $resolved = realpath($source);
        $allowed = false;
        foreach ($allowed_roots as $directory) {
            if ($resolved !== false && ($resolved === $directory || str_starts_with($resolved, $directory . '/'))) $allowed = true;
        }
        if ($resolved === false) throw new RuntimeException('Cannot resolve symbolic link: ' . $source . ' -> ' . readlink($source));
        if (!$allowed) throw new RuntimeException('Symbolic link target is outside the transferred directories: ' . $source . ' -> ' . $resolved);
        $source = $resolved;
    }
    // Copy bytes because Playground's OPFS save/restore does not preserve links yet.
    // Track the current branch only, so two aliases of one theme are allowed.
    $resolved = realpath($source);
    if ($resolved !== false && in_array($resolved, $ancestors, true)) {
        throw new RuntimeException('A symbolic link creates a directory loop: ' . $source);
    }
    $ancestors[] = $resolved;
    if (!file_exists($source)) {
        remove_tree($target);
        return;
    }
    if (is_dir($source)) {
        if (file_exists($target) && !is_dir($target)) {
            remove_tree($target);
        }
        if (!is_dir($target)) mkdir($target, 0700, true);
        foreach (array_diff(scandir($target), ['.', '..']) as $name) {
            if (!file_exists(wp_join_unix_paths($source, $name))) remove_tree(wp_join_unix_paths($target, $name));
        }
        foreach (array_diff(scandir($source), ['.', '..']) as $name) {
            sync_tree(wp_join_unix_paths($source, $name), wp_join_unix_paths($target, $name), $allowed_roots, $ancestors);
        }
    } elseif (!is_file($target) || hash_file('sha256', $source) !== hash_file('sha256', $target)) {
        remove_tree($target);
        if (!is_dir(dirname($target))) mkdir(dirname($target), 0700, true);
        if (!copy($source, $target)) throw new RuntimeException('Could not copy linked content: ' . $source);
    }
}

/**
 * Saves which Playground step the next PHP call must run.
 *
 * Reprint saves its download position, but does not know the bridge's later
 * files-prepare step. Keep that step in operation.json, separate from Reprint's
 * checkpoint. Write then rename so the next call cannot read half-written JSON.
 */
function save_operation(string $path, array $operation): void {
    file_put_contents($path . '.tmp', json_encode($operation, JSON_THROW_ON_ERROR));
    rename($path . '.tmp', $path);
}

/**
 * Clears a setup path without deleting a symbolic link's target.
 *
 * The path may be a file, directory, broken link, or absent after a retry.
 * Reprint's public remove_directory_and_its_contents() accepts directories,
 * follows a link passed as the root, and suppresses removal errors. Setup needs
 * to unlink the root link itself and let errors reach run_transfer() instead
 * of continuing after failed cleanup.
 */
function remove_tree(string $path): void {
    if (is_dir($path) && !is_link($path)) {
        foreach (array_diff(scandir($path), ['.', '..']) as $name) remove_tree(wp_join_unix_paths($path, $name));
        rmdir($path);
    } elseif (file_exists($path) || is_link($path)) {
        unlink($path);
    }
}

/**
 * Chooses Reprint's allow_http option for local development URLs.
 *
 * ImportClient still validates the transport. This helper only opts loopback
 * hosts into its HTTP exception; otherwise authenticated requests require HTTPS. Reuse it for
 * both preflight and files-pull so they accept the same development servers.
 */
function is_local_reprint_url(string $url): bool {
    return in_array(parse_url($url, PHP_URL_HOST), ['127.0.0.1', 'localhost', '[::1]'], true);
}
