<?php
/**
 * Browser adapter for Reprint v0.10.10. The token is supplied in the process
 * environment, not a connection setting or a generated script. The downloaded
 * database and files still contain the source site's private data.
 */
ini_set('max_execution_time', '0');
if (!defined('STDOUT')) define('STDOUT', fopen('php://output', 'wb'));
if (!defined('STDERR')) define('STDERR', fopen('php://stderr', 'wb'));
require 'phar:///tmp/playground-reprint.phar/packages/reprint-client/src/import.php';

use function WordPress\Filesystem\wp_join_unix_paths;
use WordPress\Reprint\Server\Utils;

/** Forward payload progress while Reprint is writing a file, not just its headers. */
class PlaygroundReprintClient extends ImportClient {
    private const MAX_SITE_BYTES = 2 * 1024 * 1024 * 1024;
    private ?int $site_file_bytes = null;
    private string $browser_progress_path;
    private string $pull_directory;
    private string $sql_path;
    private ?array $download = null;
    private float $last_byte_update = 0;
    /** Table counters from Reprint's last SQL download record, shown beside byte counts. */
    private array $sql_tables = [];

    public function __construct(string $url, string $state, string $files) {
        parent::__construct($url, $state, $files, ['allow_http' => is_local_reprint_url($url)]);
        $this->pull_directory = wp_join_unix_paths($state, 'remotes', md5(rtrim($url, '?&')), 'pull');
        $this->browser_progress_path = wp_join_unix_paths($state, 'browser-progress.json');
        $this->sql_path = wp_join_unix_paths($state, 'db.sql');
    }

    protected function fetch_streaming(string $url, ?string $cursor, \Reprint\Importer\StreamingContext $context, ?array $post_data = null, ?string $endpoint = null): void {
        if ($endpoint === 'sql_chunk') {
            $on_chunk = $context->on_chunk;
            $context->on_chunk = function (array $chunk) use ($on_chunk): void {
                if (($chunk['headers']['x-chunk-type'] ?? '') === 'sql') {
                    clearstatcache(true, $this->sql_path);
                    $this->assert_site_size(filesize($this->sql_path) + strlen($chunk['body'] ?? ''));
                }
                $on_chunk($chunk);
                $this->emit_sql_progress();
            };
            try {
                $this->emit_sql_progress(true);
                parent::fetch_streaming($url, $cursor, $context, $post_data, $endpoint);
            } finally {
                $context->on_chunk = $on_chunk;
                $this->emit_sql_progress(true);
            }
            return;
        }
        if ($endpoint !== 'file_fetch' || !is_file($this->pull_directory . '/fetch-list.jsonl')) {
            parent::fetch_streaming($url, $cursor, $context, $post_data, $endpoint);
            return;
        }
        $this->load_download_progress();
        $on_chunk = $context->on_chunk;
        $context->on_chunk = function (array $chunk) use ($on_chunk, $context): void {
            $before = ($chunk['headers']['x-first-chunk'] ?? '0') === '1' ? 0 : $context->file_bytes_written;
            $on_chunk($chunk);
            // Reprint restores this counter to its saved cursor on a retry.
            // The final callback closes the file and clears the counter.
            $written = $context->file_handle ? $context->file_bytes_written : $before + strlen($chunk['body'] ?? '');
            $this->record_download_chunk($chunk, $written);
        };
        try {
            $this->emit_download_progress(true);
            parent::fetch_streaming($url, $cursor, $context, $post_data, $endpoint);
        } finally {
            $context->on_chunk = $on_chunk;
            $this->emit_download_progress(true);
            file_put_contents($this->browser_progress_path, json_encode($this->download, JSON_THROW_ON_ERROR));
        }
    }

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

    private function load_download_progress(): void {
        if ($this->download !== null) return;
        if (is_file($this->browser_progress_path)) {
            $this->download = json_decode(file_get_contents($this->browser_progress_path), true, 512, JSON_THROW_ON_ERROR);
            return;
        }
        $sizes = [];
        $index = new RemoteIndexReader($this->pull_directory . '/remote-index.next.jsonl', $this->get_state()->remote_path_format());
        $index->open();
        while (($entry = $index->next_entry()) !== null) {
            $sizes[base64_encode($entry['path'])] = (int) $entry['size'];
        }
        $index->close();
        $this->download = ['sizes' => [], 'received' => [], 'complete' => []];
        $list = fopen($this->pull_directory . '/fetch-list.jsonl', 'rb');
        while (($line = fgets($list)) !== false) {
            $path = json_decode($line, true, 512, JSON_THROW_ON_ERROR)['path'];
            $size = $sizes[$path] ?? 0;
            $complete = ftell($list) <= $this->get_state()->fetch->offset;
            $this->download['sizes'][$path] = $size;
            $this->download['received'][$path] = $complete ? $size : 0;
            $this->download['complete'][$path] = $complete;
        }
        fclose($list);
    }

    private function record_download_chunk(array $chunk, int $bytes_written): void {
        $headers = $chunk['headers'];
        if (($headers['x-chunk-type'] ?? '') !== 'file') return;
        $path = $headers['x-file-path'];
        if (!array_key_exists($path, $this->download['sizes'])) return;
        $this->download['sizes'][$path] = (int) $headers['x-file-size'];
        // Use the writer's current position, not network bytes: resumed parts
        // can repeat data beyond the last saved cursor.
        $this->download['received'][$path] = $bytes_written;
        $this->download['complete'][$path] = ($headers['x-last-chunk'] ?? '0') === '1';
        $this->emit_download_progress();
    }

    private function emit_download_progress(bool $force = false): void {
        if (!$force && microtime(true) - $this->last_byte_update < 0.25) return;
        $this->last_byte_update = microtime(true);
        echo json_encode(['playgroundProgress' => [
            'phase' => 'files-pull',
            'message' => 'Downloading site files',
            'bytesDone' => array_sum($this->download['received']),
            'bytesTotal' => array_sum($this->download['sizes']),
            'filesDone' => count(array_filter($this->download['complete'])),
            'filesTotal' => count($this->download['sizes']),
        ]], JSON_THROW_ON_ERROR) . "\n";
    }

    private function emit_sql_progress(bool $force = false): void {
        // Measure the written SQL, including resumed batches. Remote table sizes
        // do not measure SQL dump bytes, so they cannot supply a denominator.
        clearstatcache(true, $this->sql_path);
        $done = is_file($this->sql_path) ? filesize($this->sql_path) : 0;
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

    private function assert_site_size(int $sql_bytes = 0): void {
        $file_bytes = $this->site_file_bytes;
        if ($file_bytes === null) {
            // Use the full selected index, not the incremental fetch list. The
            // mapped index includes followed targets and omits excluded paths.
            $index = fopen(wp_join_unix_paths($this->pull_directory, 'remote-index.local-map.jsonl'), 'rb');
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
        $operation_path = wp_join_unix_paths($root, 'operation.json');
        $operation = is_file($operation_path) ? json_decode(file_get_contents($operation_path), true, 512, JSON_THROW_ON_ERROR) : null;
        $kind = $request['command'] === 'finish-pull' ? 'pull' : $request['command'];
        if (!in_array($kind, ['pull', 'push'], true)) {
            throw new RuntimeException('Unknown transfer command.');
        }
        if ($operation && $operation['kind'] !== $kind) {
            throw new RuntimeException('Finish the interrupted ' . $operation['kind'] . ' before starting another transfer.');
        }
        // Older preview checkpoints either target staging or contain overlapping
        // path mappings. Rebuild that file plan rather than retrying its collision.
        if ($kind === 'pull' && $operation && (empty($operation['direct'])
            || (in_array($operation['stage'], ['preflight', 'files-pull'], true) && ($operation['pathPlanVersion'] ?? 0) < 1))) {
            $operation = null;
            remove_tree(wp_join_unix_paths($root, 'site.zip'));
            remove_tree(wp_join_unix_paths($root, 'pull-state'));
        }
        if (!$operation) {
            if ($request['command'] === 'finish-pull') {
                throw new RuntimeException('There is no pull to finish.');
            }
            if ($kind === 'pull') {
                remove_tree(wp_join_unix_paths($root, 'pull-files'));
            }
            $operation = ['kind' => $kind, 'stage' => 'preflight', 'direct' => true, 'pathPlanVersion' => 1];
            save_operation($operation_path, $operation);
        }
        // A new pull replaces the previous push baseline at completion. Its
        // old snapshot must not be repacked into every download checkpoint.
        if ($kind === 'pull' && $operation['stage'] !== 'install') {
            remove_tree(wp_join_unix_paths($root, 'push-files'));
        }
        if ($operation['stage'] === 'preflight') {
            $result = connect_site($request, $root, $operation, $lock);
        } elseif ($kind === 'pull') {
            $result = pull_site($request, $root, $operation, $lock);
        } else {
            $result = push_files($request, $root, $operation, $lock);
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

function connect_site(array $request, string $root, array &$operation, ReprintProcessLock $lock): array {
    $kind = $operation['kind'];
    $state = wp_join_unix_paths($root, $kind === 'pull' ? 'pull-state' : 'push-preflight');
    $files = $kind === 'pull' ? $request['documentRoot'] : wp_join_unix_paths($root, 'push-files');
    $client = new ImportClient($request['url'], $state, $files, ['allow_http' => is_local_reprint_url($request['url'])]);
    // Reprint now returns from preflight instead of exiting PHP. Save its
    // metadata here, before advancing the operation or emitting the next stage.
    $client->run(['command' => 'preflight', 'secret' => $request['secret'], 'progress' => 'jsonl'], $lock);
    $error = $client->get_preflight_error();
    if ($error !== null) throw new RuntimeException($error['message']);
    $preflight = $client->get_state()->preflight_record()['data'];
    $metadata = source_metadata($preflight);
    $metadata['routeHandlers'] = host_route_handlers($preflight);
    if ($kind === 'pull') {
        // A fresh pull compares against the last remote index. Reset
        // command cursors, not that index or the downloaded site files.
        // run(preflight) above loads the saved mapping fingerprints; the client
        // constructor alone starts with blank state and must not reset it.
        $client->clear_files_pull_progress();
        restore_file_baseline(
            wp_join_unix_paths(dirname($client->pull_state_directory), 'local_index.jsonl'),
            $request['documentRoot'],
            wp_join_unix_paths($root, 'pull-baseline.jsonl')
        );
        foreach (['progress.json', 'browser-progress.json', 'db.sql', 'db-session-setup.sql', 'db-tables.jsonl', 'import.sqlite', 'import.sqlite-wal', 'import.sqlite-shm', 'import.sqlite-journal'] as $file) {
            remove_tree(wp_join_unix_paths($state, $file));
        }
        $metadata['pullMappings'] = pull_path_mappings($metadata);
        // Resolve and validate every selector before file mirroring starts.
        $client->prepare_files_pull_options([
            'include' => [':abspath:', ':wp-content:'],
            'exclude' => pull_exclusions(),
            'remap' => $metadata['pullMappings'],
        ], false);
    }
    file_put_contents(wp_join_unix_paths($root, 'source.json'), json_encode($metadata, JSON_THROW_ON_ERROR));
    $operation['stage'] = $kind === 'pull' ? 'files-pull' : 'snapshot';
    return ['status' => 'continue', 'stage' => $operation['stage']];
}

function pull_site(array $request, string $root, array &$operation, ReprintProcessLock $lock): array {
    $files = $request['documentRoot'];
    $state = wp_join_unix_paths($root, 'pull-state');
    if ($operation['stage'] === 'install') {
        if ($request['command'] !== 'finish-pull') {
            return ['status' => 'install'];
        }
        // No push or incremental-pull baseline: both would hash every file in
        // the site (twice, with a full copy in between) for features the UI
        // does not offer. The push code below stays for when it does.
        remove_tree(wp_join_unix_paths($root, 'plan'));
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
        $database = wp_join_unix_paths($files, 'wp-content/database/.ht.sqlite');
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
    $client = new PlaygroundReprintClient($request['url'], $state, $files);
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
        'secret' => $request['secret'],
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
        throw new RuntimeException('Reprint stopped. Check the transfer error and retry with the same site and token.');
    }
    if ($client->exit_code === 0) {
        if ($stage === 'files-pull') save_pulled_links($files, $root, $metadata, $client);
        $operation['stage'] = $stages[array_search($stage, $stages, true) + 1];
    }
    return ['status' => 'continue', 'stage' => $operation['stage']];
}

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

/** Save selected links before OPFS drops their in-memory symlink nodes. */
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

/** Restore only selected links, including after reopening a setup checkpoint. */
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
        // OPFS stores files and directories, not symlinks. Copy only linked
        // content; ordinary downloaded files already sit at their final path.
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

function push_files(array $request, string $root, array &$operation, ReprintProcessLock $lock): array {
    if ($operation['stage'] === 'snapshot') {
        refresh_push_snapshot($request['documentRoot'], $root);
        $operation['stage'] = 'send';
        return ['status' => 'continue', 'stage' => 'send'];
    }
    $push_state = wp_join_unix_paths($root, 'push');
    $options = [
        'filesystem_root' => wp_join_unix_paths($root, 'push-files'),
        // The snapshot uses the live site's document-root-relative paths,
        // which can differ from the normalized Playground content paths.
        'document_root' => '/',
        'push_state_directory' => $push_state,
        'remote_reprint_api_url' => $request['url'],
        'hmac_client' => new Site_Export_HMAC_Client($request['secret']),
        'chunk_bytes' => 1024 * 1024,
        'allow_http' => is_local_reprint_url($request['url']),
    ];
    if (is_file(wp_join_unix_paths($push_state, 'sender.json'))) {
        $sender = PushFilesSender::resume($options, $lock);
    } else {
        restore_file_baseline(wp_join_unix_paths($root, 'local_index.jsonl'), wp_join_unix_paths($root, 'push-files'), wp_join_unix_paths($root, 'baseline.jsonl'));
        $sender = PushFilesSender::start($options, $lock);
    }
    try {
        $phase = $sender->get_phase();
        $progress = null;
        while ($sender->next_step()) {
            $next_progress = $sender->get_progress();
            if ($next_progress !== $progress && isset($next_progress['files_done'])) {
                echo json_encode(array_merge($next_progress, ['message' => 'Pushing files'])) . "\n";
            }
            $progress = $next_progress;
            // A timed cancellation can repeatedly discard the same open upload.
            // Phase changes occur after Reprint has finished that request.
            if ($sender->get_phase() !== $phase) {
                $sender->cancel();
                break;
            }
        }
        $status = $sender->get_status();
        if (in_array($status, ['failed', 'error'], true)) {
            throw new RuntimeException($sender->get_detail() ?: $sender->get_reason() ?: 'The file push failed.');
        }
        if ($status === 'complete') save_file_baseline(wp_join_unix_paths($root, 'local_index.jsonl'), wp_join_unix_paths($root, 'push-files'), wp_join_unix_paths($root, 'baseline.jsonl'));
        return ['status' => $status === 'complete' ? 'complete' : 'continue', 'stage' => $sender->get_phase()];
    } finally {
        $sender->close();
    }
}

/**
 * PHP for the request rules Reprint attributes to the source host, such as
 * WP Cloud's on-demand thumbnails. Empty when the host needs none.
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

function refresh_push_snapshot(string $document_root, string $root): void {
    $metadata_path = wp_join_unix_paths($root, 'source.json');
    $metadata = is_file($metadata_path) ? json_decode(file_get_contents($metadata_path), true, 512, JSON_THROW_ON_ERROR) : [];
    $paths = remote_push_paths($metadata);
    if ($paths === null) {
        throw new RuntimeException('Reprint reports content folders outside its writable document root. Pull can proceed, but its push API cannot write to those folders.');
    }
    $allowed_roots = array_map(fn($directory) => wp_join_unix_paths(realpath($document_root), 'wp-content', $directory), ['plugins', 'themes', 'uploads', '.reprint-linked-files']);
    foreach ($paths as $directory => $relative) {
        sync_tree(wp_join_unix_paths($document_root, 'wp-content', $directory), wp_join_unix_paths($root, 'push-files', $relative), $allowed_roots);
    }
}

function remote_push_paths(array $metadata): ?array {
    // Checkpoints from before path mapping passed the standard-layout check.
    if (!array_key_exists('paths', $metadata)) {
        return ['plugins' => 'wp-content/plugins', 'themes' => 'wp-content/themes', 'uploads' => 'wp-content/uploads'];
    }
    $paths = $metadata['paths'];
    $content = $paths['content_dir'] ?? null;
    $docroot = $metadata['documentRoot'];
    if (!is_string($content) || !is_string($docroot)) return null;
    $prefix = rtrim($docroot, '/') . '/';
    $targets = [
        'plugins' => $paths['plugins_dir'] ?? wp_join_unix_paths($content, 'plugins'),
        'themes' => wp_join_unix_paths($content, 'themes'),
        'uploads' => $paths['uploads']['basedir'] ?? wp_join_unix_paths($content, 'uploads'),
    ];
    foreach ($targets as $directory => $path) {
        // The pinned push API accepts paths beneath its document root only.
        // Never substitute a standard path that points at a different folder.
        if (!str_starts_with($path, $prefix)) return null;
        $relative = substr($path, strlen($prefix));
        if ($relative === '' || in_array('..', explode('/', $relative), true)) return null;
        $targets[$directory] = $relative;
    }
    return $targets;
}

/** Keep unchanged snapshot files in place so Reprint can compare their local stats. */
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
    // A snapshot contains file bytes, not links into another server's filesystem.
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
        if (!copy($source, $target)) throw new RuntimeException('Could not stage ' . $source);
    }
}

/** OPFS restores bytes, not ctime. Retain hashes across browser restarts. */
function save_file_baseline(string $index_path, string $files, string $path): void {
    $index = fopen($index_path, 'rb');
    $output = fopen($path . '.tmp', 'wb');
    while (($line = fgets($index)) !== false) {
        $entry = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        if ($entry['type'] === 'file') {
            $entry['sha256'] = hash_file('sha256', wp_join_unix_paths($files, base64_decode($entry['path'])));
        }
        $line = json_encode($entry, JSON_THROW_ON_ERROR) . "\n";
        if (fwrite($output, $line) !== strlen($line)) throw new RuntimeException('Could not save the file baseline.');
    }
    fclose($index);
    fclose($output);
    rename($path . '.tmp', $path);
}

/** Give Reprint current stats only for files whose bytes still match the baseline. */
function restore_file_baseline(string $target, string $files, string $path): void {
    if (!is_file($path)) return;
    $baseline = fopen($path, 'rb');
    $output = fopen($target . '.tmp', 'wb');
    while (($line = fgets($baseline)) !== false) {
        $entry = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        $file = wp_join_unix_paths($files, base64_decode($entry['path']));
        if ($entry['type'] === 'file') {
            $entry['ctime'] = is_file($file) && hash_file('sha256', $file) === $entry['sha256'] ? filectime($file) : 0;
            unset($entry['sha256']);
        }
        $line = json_encode($entry, JSON_THROW_ON_ERROR) . "\n";
        if (fwrite($output, $line) !== strlen($line)) throw new RuntimeException('Could not restore the file baseline.');
    }
    fclose($baseline);
    fclose($output);
    rename($target . '.tmp', $target);
}

function build_plan(string $root): PushPlan {
    $directory = wp_join_unix_paths($root, 'plan');
    remove_tree($directory);
    mkdir($directory, 0700, true);
    $exclusions = wp_join_unix_paths($root, 'exclusions.json');
    file_put_contents($exclusions, '[]');
    $plan = PushPlan::start($directory, wp_join_unix_paths($root, 'push-files'), wp_join_unix_paths($root, 'local_index.jsonl'), $exclusions);
    while ($plan->next_step()) {}
    return $plan;
}

function zip_tree(ZipArchive $zip, string $root, string $relative): void {
    foreach (array_diff(scandir(wp_join_unix_paths($root, $relative)), ['.', '..']) as $name) {
        $path = wp_join_unix_paths($relative, $name);
        $absolute = wp_join_unix_paths($root, $path);
        if (is_link($absolute)) throw new RuntimeException('Symbolic links are not supported by this browser transfer preview: ' . $path);
        if (is_dir($absolute)) {
            $zip->addEmptyDir($path);
            zip_tree($zip, $root, $path);
        } else {
            $zip->addFile($absolute, $path);
            $zip->setCompressionName($path, ZipArchive::CM_STORE);
        }
    }
}

function save_operation(string $path, array $operation): void {
    file_put_contents($path . '.tmp', json_encode($operation, JSON_THROW_ON_ERROR));
    rename($path . '.tmp', $path);
}

function remove_tree(string $path): void {
    if (is_dir($path) && !is_link($path)) {
        foreach (array_diff(scandir($path), ['.', '..']) as $name) remove_tree(wp_join_unix_paths($path, $name));
        rmdir($path);
    } elseif (file_exists($path) || is_link($path)) {
        unlink($path);
    }
}

function is_local_reprint_url(string $url): bool {
    return in_array(parse_url($url, PHP_URL_HOST), ['127.0.0.1', 'localhost', '[::1]'], true);
}
