<?php
/**
 * Browser adapter for Reprint v0.10.13. The token is supplied in the process
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
    private ?array $download = null;
    private float $last_byte_update = 0;

    /** Keep progress beside the Reprint checkpoint for this source URL. */
    public function __construct(string $url, string $state, string $files) {
        parent::__construct($url, $state, $files, ['allow_http' => is_local_reprint_url($url)]);
        $this->pull_directory = wp_join_unix_paths($state, 'remotes', md5(rtrim($url, '?&')), 'pull');
        $this->browser_progress_path = wp_join_unix_paths($state, 'browser-progress.json');
    }

    /** Measure bytes at the writer callback, including resumed parts. */
    protected function fetch_streaming(string $url, \Reprint\Importer\StreamingContext $context, ?array $post_data = null, ?string $endpoint = null): void {
        if ($endpoint !== 'file_fetch' || !is_file($this->pull_directory . '/fetch-list.jsonl')) {
            parent::fetch_streaming($url, $context, $post_data, $endpoint);
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
            parent::fetch_streaming($url, $context, $post_data, $endpoint);
        } finally {
            $context->on_chunk = $on_chunk;
            $this->emit_download_progress(true);
            file_put_contents($this->browser_progress_path, json_encode($this->download, JSON_THROW_ON_ERROR));
        }
    }

    /** Check indexed size before mirroring and forward file progress. */
    public function output_progress(array $data, bool $force = false): void {
        if (($data['command'] ?? '') === 'files-pull' && ($data['event'] ?? '') === 'stage'
            && in_array($data['stage'] ?? '', ['diff', 'mirror', 'fetch'], true)) {
            // The mapped index is complete and filtered here. Check before the
            // diff can delete local files or fetch their replacements, including
            // when Reprint resumes directly at a later stage.
            $this->assert_site_size();
        }
        parent::output_progress($data, $force);
    }

    /** Rebuild byte totals from selected files and the saved fetch cursor. */
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

    /** Count the current writer position rather than repeated network bytes. */
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

    /** Emit byte and file totals at most four times per second. */
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

    /** Reject selected file bytes above the browser import limit. */
    private function assert_site_size(): void {
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
        if ($file_bytes > self::MAX_SITE_BYTES) {
            throw new RuntimeException('This site exceeds Playground’s 2 GiB import limit (site files). Use the Reprint CLI to pull this site locally.');
        }
        $this->site_file_bytes = $file_bytes;
    }
}

if (getenv('PLAYGROUND_REPRINT') !== false) {
    run_transfer();
}

/** Resume one locked pull stage and persist it before returning to JavaScript. */
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
        if ($request['command'] !== 'pull') {
            throw new RuntimeException('Unknown pull command.');
        }
        if (!$operation) {
            $operation = ['stage' => 'preflight'];
            save_operation($operation_path, $operation);
        }
        if ($operation['stage'] === 'preflight') {
            $result = connect_site($request, $root, $operation, $lock);
        } else {
            $result = pull_site($request, $root, $operation, $lock);
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

/** Save validated preflight metadata and mappings before any mirror writes. */
function connect_site(array $request, string $root, array &$operation, ReprintProcessLock $lock): array {
    $state = wp_join_unix_paths($root, 'pull-state');
    $files = $request['documentRoot'];
    $client = new ImportClient($request['url'], $state, $files, ['allow_http' => is_local_reprint_url($request['url'])]);
    // Reprint now returns from preflight instead of exiting PHP. Save its
    // metadata here, before advancing the operation or emitting the next stage.
    $client->run(['command' => 'preflight', 'secret' => $request['secret'], 'progress' => 'jsonl'], $lock);
    $error = $client->get_preflight_error();
    if ($error !== null) throw new RuntimeException($error['message']);
    $preflight = $client->get_state()->preflight_record()['data'];
    $metadata = source_metadata($preflight);
    // A fresh pull compares against the last remote index. Reset
    // command cursors, not that index or the downloaded site files.
    // run(preflight) above loads the saved mapping fingerprints; the client
    // constructor alone starts with blank state and must not reset it.
    $client->clear_files_pull_progress();
    foreach (['progress.json', 'browser-progress.json'] as $file) {
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

/** Write site files directly and materialize selected linked content. */
function pull_site(array $request, string $root, array &$operation, ReprintProcessLock $lock): array {
    $files = $request['documentRoot'];
    $state = wp_join_unix_paths($root, 'pull-state');
    $stage = $operation['stage'];
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
        return ['status' => 'complete'];
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
    ], $lock);
    if ($client->exit_code !== 0 && $client->exit_code !== 2) {
        throw new RuntimeException('Reprint stopped. Check the transfer error and retry with the same site and token.');
    }
    if ($client->exit_code === 0) {
        if ($stage === 'files-pull') save_pulled_links($files, $root, $metadata, $client);
        $operation['stage'] = 'files-prepare';
    }
    return ['status' => 'continue', 'stage' => $operation['stage']];
}

/** Map active WordPress folders without colliding with bundled copies. */
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

/** Keep local runtime configuration outside incoming writes and deletions. */
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

/** Replace selected links with ordinary files that OPFS can persist. */
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

/** Read WordPress paths and the table prefix from the preflight report. */
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

/** Copy a linked tree without escaping downloaded content or following cycles. */
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
    // The local copy must contain bytes, not links into another server's filesystem.
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

/** Record the next stage before the PHP process returns. */
function save_operation(string $path, array $operation): void {
    file_put_contents($path . '.tmp', json_encode($operation, JSON_THROW_ON_ERROR));
    rename($path . '.tmp', $path);
}

/** Remove a local tree without descending through links. */
function remove_tree(string $path): void {
    if (is_dir($path) && !is_link($path)) {
        foreach (array_diff(scandir($path), ['.', '..']) as $name) remove_tree(wp_join_unix_paths($path, $name));
        rmdir($path);
    } elseif (file_exists($path) || is_link($path)) {
        unlink($path);
    }
}

/** Allow plain HTTP only for a loopback development server. */
function is_local_reprint_url(string $url): bool {
    return in_array(parse_url($url, PHP_URL_HOST), ['127.0.0.1', 'localhost', '[::1]'], true);
}
