<?php
// Run with PHP 8.1+ after placing the pinned PHAR at /tmp/playground-reprint.phar.
// These checks use Reprint's real mapper, writer, and checkpoint lifecycle.
require __DIR__ . '/bridge.php';

$root = sys_get_temp_dir() . '/playground-reprint-test-' . bin2hex(random_bytes(8));
$site = $root . '/site';
$state = $root . '/state';
mkdir($site . '/wp-content/plugins', 0700, true);
mkdir($state, 0700, true);

try {
    file_put_contents($site . '/wp-content/plugins/keep.php', 'aaaa');
    file_put_contents($site . '/wp-config.php', 'production credentials');
    mkdir($site . '/wp-content/database');
    file_put_contents($site . '/wp-content/database/.ht.sqlite', 'private database');
    mkdir($site . '/wp-content/themes');
    mkdir($site . '/wp-content/uploads');
    $data = [
        'runtime' => ['document_root' => '/srv/public'],
        'database' => ['wp' => [
            'table_prefix' => 'site_7_',
            'multisite' => ['enabled' => true],
            'paths_urls' => [
                'abspath' => '/opt/wordpress',
                'content_dir' => '/srv/public/content',
                'plugins_dir' => '/srv/public/extensions',
                'uploads' => ['basedir' => '/srv/public/media'],
            ],
        ]],
    ];
    check_preflight_lifecycle($root, $data);
    $metadata = source_metadata($data);
    check($metadata['tablePrefix'] === 'site_7_', 'Custom layouts and multisite do not block preflight.');
    $data['database']['wp']['paths_urls']['content_dir'] = '/srv/public-other/content';
    foreach ([
        ['/core/wp-content', '/core/wp-content/plugins'],
        ['/srv/content', '/srv/extensions'],
        ['/core/wp-content/custom', '/core/wp-content/custom/plugins'],
    ] as [$content, $plugins]) {
        $layout = ['paths' => ['abspath' => '/core', 'content_dir' => $content, 'plugins_dir' => $plugins]];
        $rules = pull_path_mappings($layout);
        $resolved = [];
        foreach ($rules as [$source, $target]) $resolved[$source] = str_replace(':fs-root:', $site, $target);
        $mapper = new RemoteToLocalPathMapper($site, 'unix', ['/core', $content, $plugins], $resolved);
        $remote_paths = array_unique(['/core/wp-content/index.php', $content . '/index.php', '/core/wp-content/plugins/bundled.php', $content . '/plugins/bundled.php', $plugins . '/bundled.php']);
        $index = $root . '/layout-index.jsonl';
        file_put_contents($index, implode("\n", array_map(fn($path) => json_encode(['path' => base64_encode($path), 'type' => 'file', 'size' => 1, 'ctime' => 1]), $remote_paths)) . "\n");
        MappedRemoteIndexBuilder::build([
            'remote_index_file' => $index,
            'mapped_remote_index_file' => $root . '/mapped-layout.jsonl',
            'filesystem_root' => $site,
            'path_mapper' => $mapper,
        ]);
        check($mapper->remote_path_to_local_path($content . '/index.php') === $site . '/wp-content/index.php', 'The active content directory gets the live wp-content path.');
        check($mapper->remote_path_to_local_path($plugins . '/bundled.php') === $site . '/wp-content/plugins/bundled.php', 'The active plugins directory gets the live plugins path.');
        if ($content !== '/core/wp-content') {
            check($mapper->remote_path_to_local_path('/core/wp-content/index.php') !== $site . '/wp-content/index.php', 'Bundled content cannot collide with active content.');
        }
        $setup_client = new PlaygroundReprintClient('https://example.com', $root . '/layout-state-' . md5($content), $site);
        $setup_client->get_state()->set_preflight_record(['http_code' => 200, 'data' => ['database' => ['wp' => ['paths_urls' => $layout['paths']]]]]);
        $setup_client->prepare_files_pull_options(['include' => [':abspath:', ':wp-content:'], 'exclude' => pull_exclusions(), 'remap' => $rules]);
    }

    // Totals come from selected files, not every file in the remote index.
    $download_state = $root . '/download-state';
    $client = new PlaygroundReprintClient('https://example.com', $download_state, $root . '/download-files');
    $pull = $download_state . '/remotes/' . md5('https://example.com') . '/pull';
    if (!is_dir($pull)) mkdir($pull, 0700, true);
    $first_path = base64_encode('/source/first.txt');
    $large_path = base64_encode('/source/large.txt');
    $first_line = json_encode(['path' => $first_path]) . "\n";
    file_put_contents($pull . '/fetch-list.jsonl', $first_line . json_encode(['path' => $large_path]) . "\n");
    file_put_contents($pull . '/remote-index.next.jsonl', implode("\n", [
        json_encode(['path' => $first_path, 'size' => 8]),
        json_encode(['path' => $large_path, 'size' => 16]),
        json_encode(['path' => base64_encode('/source/excluded.txt'), 'size' => 1000]),
    ]) . "\n");
    $client->get_state()->fetch->offset = strlen($first_line);
    (new ReflectionMethod($client, 'load_download_progress'))->invoke($client);
    $record = new ReflectionMethod($client, 'record_download_chunk');
    $emit = new ReflectionMethod($client, 'emit_download_progress');
    $headers = ['x-chunk-type' => 'file', 'x-file-path' => $large_path, 'x-file-size' => '16', 'x-first-chunk' => '1', 'x-last-chunk' => '0'];
    ob_start();
    $record->invoke($client, ['headers' => $headers, 'body' => 'aaaa'], 4);
    $emit->invoke($client, true);
    $updates = array_filter(explode("\n", trim(ob_get_clean())));
    $update = json_decode(end($updates), true)['playgroundProgress'];
    check($update['bytesDone'] === 12 && $update['bytesTotal'] === 24, 'Byte progress includes partial files and excludes unselected files.');
    check($update['filesDone'] === 1 && $update['filesTotal'] === 2, 'An unfinished large file is not counted as complete.');
    ob_start();
    $record->invoke($client, ['headers' => $headers, 'body' => 'bb'], 2);
    $emit->invoke($client, true);
    $updates = array_filter(explode("\n", trim(ob_get_clean())));
    $update = json_decode(end($updates), true)['playgroundProgress'];
    check($update['bytesDone'] === 10, 'Restarting a file replaces its old partial byte count.');
    $headers['x-first-chunk'] = '0';
    $headers['x-last-chunk'] = '1';
    ob_start();
    $record->invoke($client, ['headers' => $headers, 'body' => str_repeat('c', 14)], 16);
    $emit->invoke($client, true);
    $updates = array_filter(explode("\n", trim(ob_get_clean())));
    $update = json_decode(end($updates), true)['playgroundProgress'];
    check($update['bytesDone'] === 24 && $update['filesDone'] === 2, 'Completing the last file fills the byte total exactly.');

    // Exercise the pinned client's actual path mapping and writer, not a mock.
    $writer = new PlaygroundReprintClient('https://example.com', $root . '/writer-state', $site);
    $writer->get_state()->set_preflight_record(['http_code' => 200, 'data' => $data]);
    $writer->prepare_files_pull_options([
        'include' => [':abspath:', ':wp-content:'],
        'exclude' => pull_exclusions(),
        'remap' => [
            [':abspath:', ':fs-root:'],
            [':wp-content:', ':fs-root:/wp-content'],
        ],
    ], false);
    $selected = new ReflectionMethod(ImportClient::class, 'is_selected_for_pulling');
    foreach (['/opt/wordpress/wp-runtime.json', '/opt/wordpress/blueprint-bundle/blueprint.json', '/opt/wordpress/wp-config.php', '/opt/wordpress/.playground-reprint/checkpoint.zip', '/srv/public-other/content/database/.ht.sqlite', '/srv/public-other/content/mu-plugins/0-playground.php'] as $protected) {
        check(!$selected->invoke($writer, $protected, true, 'file'), 'Incoming runtime files are excluded: ' . $protected);
        check(!$selected->invoke($writer, $protected, false, 'file'), 'Runtime files are outside mirror deletions: ' . $protected);
    }
    $theme_path = '/srv/public-other/content/themes/iotix/style.css';
    check($selected->invoke($writer, $theme_path, true, 'file'), 'The active theme remains selected in a custom content layout.');
    (new ReflectionMethod(ImportClient::class, 'handle_file_chunk'))->invoke($writer, [
        'headers' => ['x-file-path' => base64_encode($theme_path), 'x-first-chunk' => '1', 'x-last-chunk' => '1', 'x-file-size' => '18'],
        'body' => 'Theme Name: Iotix!',
    ], new \Reprint\Importer\StreamingContext());
    check(file_get_contents($site . '/wp-content/themes/iotix/style.css') === 'Theme Name: Iotix!', 'Reprint writes theme bytes directly into the running site directory.');
    remove_tree($site . '/wp-content/themes/iotix');

    $mapped = pull_path_mappings(['paths' => ['abspath' => '/srv/site', 'content_dir' => '/srv/site/wp-content', 'mu_plugins_dir' => false]]);
    check(in_array(['/srv/site/wp-content/mu-plugins', ':fs-root:/wp-content/mu-plugins'], $mapped, true), 'A directory Reprint reports as missing maps to its default location instead of an empty path.');
    foreach (['http://127.0.0.1:9417', 'http://localhost:9417', 'http://[::1]:9417'] as $url) {
        new PlaygroundReprintClient($url, $root . '/http-' . md5($url), $site);
    }
    $rejected = false;
    try { new PlaygroundReprintClient('http://example.com', $root . '/remote-http', $site); }
    catch (InvalidArgumentException $error) { $rejected = true; }
    check($rejected, 'The new transport opt-in remains limited to local development URLs.');

    // Host-plugin filtering can leave an intermediate link in the index without
    // its package. The pinned client must skip it before OPFS preparation runs.
    $link_site = $root . '/excluded-link-site';
    mkdir($link_site);
    $link_state = $root . '/excluded-link-state';
    $link_client = new PlaygroundReprintClient('https://example.com', $link_state, $link_site);
    $link_client->prepare_files_pull_options([
        'include' => ['/srv/htdocs'],
        'remap' => [['/srv/wordpress/plugins', ':fs-root:/wp-content/.reprint-linked-files/srv/wordpress/plugins']],
    ], false);
    $link_pull = $link_state . '/remotes/' . md5('https://example.com') . '/pull';
    file_put_contents($link_pull . '/remote-index.next.jsonl', json_encode([
        'path' => base64_encode('/srv/wordpress/plugins/wpcomsh/latest'),
        'target' => base64_encode('10.0.0-alpha+rolling'),
        'ctime' => 1, 'size' => 0, 'type' => 'link', 'intermediate' => true,
    ]) . "\n");
    (new ReflectionMethod(ImportClient::class, 'recreate_intermediate_symlinks'))->invoke($link_client);
    $skipped_link = $link_site . '/wp-content/.reprint-linked-files/srv/wordpress/plugins/wpcomsh/latest';
    check(!is_link($skipped_link) && !file_exists($skipped_link), 'An intermediate link without a downloaded target is not recreated.');
    check(str_contains(file_get_contents($link_state . '/audit.log'), 'target was not downloaded'), 'The skipped intermediate link is explained in the audit log.');
    materialize_site_links($link_site, $link_site, $root . '/excluded-link-copy');

    check_link_setup_lifecycle($root);
    check_site_size_limit($root);

    echo "All Reprint bridge checks passed.\n";
} finally {
    remove_tree($root);
}

/** Stop the standalone check at the first broken invariant. */
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

/** Exercise the real PHAR and bridge process, including setup returning to its caller. */
function check_preflight_lifecycle(string $root, array $data): void {
    $server_root = $root . '/preflight-server';
    mkdir($server_root);
    file_put_contents($server_root . '/router.php', '<?php
file_put_contents(__DIR__ . "/requests.log", ($_REQUEST["endpoint"] ?? "unknown") . "\n", FILE_APPEND);
header("Content-Type: application/json");
readfile(__DIR__ . "/response.json");
');
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if ($socket === false) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $server = proc_open([PHP_BINARY, '-S', $address, $server_root . '/router.php'], [
        0 => ['pipe', 'r'],
        1 => ['file', $server_root . '/server.log', 'a'],
        2 => ['file', $server_root . '/server.log', 'a'],
    ], $pipes);
    if (!is_resource($server)) throw new RuntimeException('Could not start the preflight fixture server.');
    fclose($pipes[0]);
    $transfer_roots = [];
    try {
        $ready = false;
        $deadline = microtime(true) + 5;
        do {
            $socket = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
            if ($socket !== false) {
                fclose($socket);
                $ready = true;
                break;
            }
            usleep(10000);
        } while (microtime(true) < $deadline);
        check($ready, 'The preflight fixture server starts.');
        $data['ok'] = true;
        $data['database']['wp']['multisite']['enabled'] = false;
        $url = 'http://' . $address . '/?reprint-api';
        foreach (['pull' => 'files-pull'] as $kind => $next_stage) {
            $site = $root . '/preflight-' . $kind;
            mkdir($site);
            $transfer = '/tmp/playground-reprint-state/' . md5($site . "\n" . $url);
            $transfer_roots[] = $transfer;
            $request = ['command' => $kind, 'documentRoot' => $site, 'url' => $url, 'secret' => 'test-key', 'siteUrl' => 'https://playground.test'];
            $previous_index = null;
            if ($kind === 'pull') {
                $client = new PlaygroundReprintClient($url, $transfer . '/pull-state', $site);
                $previous_index = $client->pull_state_directory . '/remote-index.jsonl';
                file_put_contents($previous_index, json_encode(['path' => base64_encode('/remote/keep.php'), 'type' => 'file', 'size' => 4, 'ctime' => 1]) . "\n");
                file_put_contents($transfer . '/pull-state/progress.json', '{"command":"files-pull","status":"complete"}');
                file_put_contents($transfer . '/pull-state/browser-progress.json', '{"bytesDone":999}');
                $client->get_state()->resolved_path_mappings_fingerprint = 'saved-mapping-fingerprint';
                $client->get_state()->active_resumable_command->command_name = 'db-apply';
                $client->get_state()->active_resumable_command->completion_state = 'complete';
                $client->save_state();
            }
            // A failed setup must leave the same operation retryable. A successful
            // retry must save its metadata before any file or database stage runs.
            foreach ([false, true] as $accepted) {
                file_put_contents($server_root . '/response.json', json_encode($accepted ? $data : ['ok' => false, 'error' => 'Fixture denied the connection.']));
                $process = proc_open([PHP_BINARY, __DIR__ . '/bridge.php'], [
                    0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w'],
                ], $pipes, null, array_merge(getenv(), ['PLAYGROUND_REPRINT' => json_encode($request)]));
                fclose($pipes[0]);
                $output = stream_get_contents($pipes[1]);
                $errors = stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $exit = proc_close($process);
                $operation = json_decode(file_get_contents($transfer . '/operation.json'), true);
                if ($kind === 'pull') {
                    check(is_file($previous_index) && filesize($previous_index) > 0, 'Starting or retrying preflight preserves the prior remote index.');
                    $progress = is_file($transfer . '/pull-state/progress.json') ? json_decode(file_get_contents($transfer . '/pull-state/progress.json'), true) : [];
                    check(($progress['command'] ?? null) !== 'files-pull', 'Preflight must not leave the previous file transfer marked complete.');
                    if ($accepted) foreach (['browser-progress.json'] as $file) {
                        check(!is_file($transfer . '/pull-state/' . $file), 'A fresh pull clears stale completion, byte counts: ' . $file);
                    }
                }

                if (!$accepted) {
                    check($exit !== 0 && str_contains($errors, 'Fixture denied the connection.'), 'A failed preflight reports the remote error: ' . $errors);
                    check($operation['stage'] === 'preflight' && !is_file($transfer . '/source.json'), 'A failed preflight does not advance the operation.');
                    continue;
                }
                check($exit === 0, 'A successful ' . $kind . ' preflight returns without entering the next stage: ' . $errors);
                $metadata = json_decode(file_get_contents($transfer . '/source.json'), true);
                check($operation['stage'] === $next_stage && $metadata['tablePrefix'] === $data['database']['wp']['table_prefix'], 'Setup metadata is saved before the next stage.');
                if ($kind === 'pull') {
                    check(!empty($metadata['pullMappings']), 'Pull path mappings are ready before downloading files.');
                    $saved_state = json_decode(file_get_contents(dirname($previous_index) . '/state.json'), true);
                    check($saved_state['resolved_path_mappings_fingerprint'] === 'saved-mapping-fingerprint', 'A fresh pull resets loaded cursors without losing the saved mapping fingerprint.');
                }
                $results = [];
                foreach (explode("\n", trim($output)) as $line) {
                    $record = json_decode($line, true);
                    if (isset($record['playgroundReprint'])) $results[] = $record['playgroundReprint'];
                }
                check(count($results) === 1 && $results[0]['status'] === 'continue' && $results[0]['stage'] === $next_stage, 'Preflight emits exactly one next-stage result.');
                check(is_file($transfer . '/source.json') && is_file($transfer . '/operation.json'), 'Preflight records the setup metadata and the next stage in the session state.');
            }
        }
        check(array_unique(file($server_root . '/requests.log', FILE_IGNORE_NEW_LINES)) === ['preflight'], 'Setup does not start a file or database transfer.');
    } finally {
        proc_terminate($server);
        proc_close($server);
        foreach ($transfer_roots as $transfer) remove_tree($transfer);
    }
}

/** Reproduce a canonical indexed theme target fetched through a remote host alias. */
function check_link_setup_lifecycle(string $root): void {
    $site = $root . '/wordpress';
    $transfer = $root . '/link-setup';
    $state = $transfer . '/pull-state';
    mkdir($site, 0700, true);
    $site = realpath($site);
    $metadata = ['paths' => ['abspath' => '/wordpress/core/7.1.2', 'content_dir' => '/srv/htdocs/wp-content']];
    $metadata['pullMappings'] = pull_path_mappings($metadata);
    $client = new PlaygroundReprintClient('https://example.com', $state, $site);
    $client->get_state()->set_preflight_record(['http_code' => 200, 'data' => ['database' => ['wp' => ['paths_urls' => $metadata['paths']]]]]);
    $client->prepare_files_pull_options([
        'include' => [':abspath:', ':wp-content:'],
        'remap' => $metadata['pullMappings'],
        'follow_symlinks' => true,
        'local_followed_symlinks_root' => ':fs-root:/wp-content/.reprint-linked-files',
    ], false);
    // run() normally sets this before preparing the pull. The fixture invokes
    // the writer directly so it needs the same resolved destination.
    (new ReflectionProperty(ImportClient::class, 'local_followed_symlinks_root'))->setValue($client, $site . '/wp-content/.reprint-linked-files');
    $remote_link = '/srv/htdocs/wp-content/themes/iotix';
    $remote_target = '/wordpress/themes/pub/iotix';
    file_put_contents($client->pull_state_directory . '/remote-index.next.jsonl', implode("\n", [
        json_encode(['path' => base64_encode($remote_link), 'target' => base64_encode($remote_target), 'ctime' => 1, 'size' => 35, 'type' => 'link']),
        json_encode(['path' => base64_encode($remote_target . '/style.css'), 'ctime' => 1, 'size' => 17, 'type' => 'file']),
        json_encode(['path' => base64_encode('/srv/wordpress'), 'target' => base64_encode('../wordpress'), 'ctime' => 1, 'size' => 0, 'type' => 'link', 'intermediate' => true]),
    ]) . "\n");
    (new ReflectionMethod(ImportClient::class, 'handle_file_chunk'))->invoke($client, [
        'headers' => ['x-file-path' => base64_encode($remote_target . '/style.css'), 'x-first-chunk' => '1', 'x-last-chunk' => '1', 'x-file-size' => '17'],
        'body' => 'Theme Name: Iotix!',
    ], new \Reprint\Importer\StreamingContext());
    (new ReflectionMethod(ImportClient::class, 'handle_symlink_chunk'))->invoke($client, [
        'headers' => ['x-symlink-path' => base64_encode($remote_link), 'x-symlink-target' => base64_encode('../../../wordpress/themes/pub/iotix'), 'x-symlink-ctime' => '1'],
    ]);
    $theme = $site . '/wp-content/themes/iotix';
    $target = $site . '/wp-content/.reprint-linked-files/wordpress/themes/pub/iotix';
    check(is_link($theme) && !file_exists($theme), 'The pinned writer reproduces the broken relative theme link.');
    check(file_get_contents($target . '/style.css') === 'Theme Name: Iotix!', 'The canonical theme bytes were already downloaded.');
    file_put_contents($transfer . '/source.json', json_encode($metadata));
    file_put_contents($state . '/progress.json', json_encode(['command' => 'files-pull', 'status' => 'complete']));
    $operation = ['stage' => 'files-pull'];
    $request = ['documentRoot' => $site, 'url' => 'https://example.com'];
    $lock = new ReprintProcessLock($transfer);
    try {
        $result = pull_site($request, $transfer, $operation, $lock);
        check($result['stage'] === 'files-prepare', 'A completed download advances to local setup without contacting the server.');
        $links = json_decode(file_get_contents($transfer . '/links.json'), true);
        check($links === [['path' => $theme, 'target' => $target]], 'Only the selected theme link is saved, using its canonical indexed target.');
        unlink($theme); // OPFS restores files and directories, not symlink nodes.
        unlink($target . '/style.css');
        rmdir($target);
        $rejected = false;
        try { pull_site($request, $transfer, $operation, $lock); }
        catch (RuntimeException $error) { $rejected = str_contains($error->getMessage(), 'Downloaded link target is missing: ' . $theme); }
        check($rejected && $operation['stage'] === 'files-prepare', 'A missing downloaded target reports its path and retains the local setup stage.');
        mkdir($target);
        file_put_contents($target . '/style.css', 'Theme Name: Iotix!');
        $result = pull_site($request, $transfer, $operation, $lock);
        check($result['status'] === 'complete', 'Retrying local setup completes without rerunning the file pull.');
        check(!is_link($theme) && file_get_contents($theme . '/style.css') === 'Theme Name: Iotix!', 'The theme becomes ordinary files that survive browser storage.');
        $operation['stage'] = 'files-prepare';
        file_put_contents($theme . '/style.css', 'Local theme edit');
        pull_site($request, $transfer, $operation, $lock);
        check(file_get_contents($theme . '/style.css') === 'Local theme edit', 'Resuming setup leaves an already materialized theme intact.');
    } finally {
        $lock->close();
    }
}

/** Reject oversized selected indexes before writes, including resumed stages. */
function check_site_size_limit(string $root): void {
    $site = $root . '/size-site';
    $state = $root . '/size-state';
    mkdir($site);
    $url = 'https://example.com/?reprint-api';
    $limit = 2 * 1024 * 1024 * 1024;
    $client = new PlaygroundReprintClient($url, $state, $site);
    $client->get_state()->set_preflight_record(['http_code' => 200, 'data' => [
        'runtime' => ['document_root' => '/source'],
        'database' => ['wp' => ['paths_urls' => ['abspath' => '/source', 'content_dir' => '/source/wp-content']]],
    ]]);
    $client->prepare_files_pull_options([
        'include' => [':abspath:'],
        'exclude' => ['/source/excluded'],
        'remap' => [[':abspath:', ':fs-root:']],
    ], false);
    (new ReflectionProperty(ImportClient::class, 'files_pull_mode'))->setValue($client, 'mirror');
    $pull = $client->pull_state_directory;
    $entries = [
        ['path' => '/source/a', 'type' => 'file', 'size' => $limit - 1],
        ['path' => '/source/b', 'type' => 'file', 'size' => 2],
        ['path' => '/source/excluded/backup.zip', 'type' => 'file', 'size' => $limit * 2],
        ['path' => '/source/folder', 'type' => 'dir', 'size' => $limit],
    ];
    $write_index = function () use (&$entries, $pull): void {
        file_put_contents($pull . '/remote-index.next.jsonl', implode("\n", array_map(
            fn($entry) => json_encode(array_merge($entry, ['path' => base64_encode($entry['path']), 'ctime' => 1])),
            $entries
        )) . "\n");
    };
    $write_index();
    // Identical old and new indexes model a repeat pull with no changed files.
    copy($pull . '/remote-index.next.jsonl', $pull . '/remote-index.jsonl');
    file_put_contents($site . '/keep-local.txt', 'Do not remove before checking size.');
    $active = $client->get_state()->active_resumable_command;
    $active->command_name = 'files-pull';
    $active->completion_state = 'partial';
    $active->current_stage = 'local-index';
    $client->get_state()->files_pull_path_selection_fingerprint =
        (new ReflectionMethod(ImportClient::class, 'files_pull_path_selection_fingerprint'))->invoke($client);
    $rejected = false;
    ob_start();
    try { $client->run_files_pull(); }
    catch (RuntimeException $error) { $rejected = str_contains($error->getMessage(), '2 GiB import limit'); }
    finally { ob_end_clean(); }
    check($rejected, 'A full index over the limit is rejected even when no remote files changed.');
    check(!is_file($pull . '/fetch-list.jsonl'), 'The size check runs before the download plan.');
    check(file_get_contents($site . '/keep-local.txt') === 'Do not remove before checking size.', 'An oversized pull does not delete local files.');
    check(!is_file($site . '/a') && !is_file($site . '/b'), 'An oversized pull does not download site files.');

    // Checkpoint resumes must not skip validation merely because indexing ended.
    foreach (['diff', 'mirror', 'fetch'] as $stage) {
        $retry = new PlaygroundReprintClient($url, $state, $site);
        $rejected = false;
        try { $retry->output_progress(['command' => 'files-pull', 'event' => 'stage', 'stage' => $stage]); }
        catch (RuntimeException $error) { $rejected = str_contains($error->getMessage(), '2 GiB import limit'); }
        check($rejected, 'A resumed ' . $stage . ' stage still checks the full index.');
    }

    $entries[1]['size'] = 1;
    $write_index();
    MappedRemoteIndexBuilder::build([
        'remote_index_file' => $pull . '/remote-index.next.jsonl',
        'mapped_remote_index_file' => $pull . '/remote-index.local-map.jsonl',
        'filesystem_root' => realpath($site),
        'path_mapper' => (new ReflectionMethod(ImportClient::class, 'path_mapper'))->invoke($client),
        'excluded_remote_absolute_path_prefixes' => ['/source/excluded'],
    ]);
    $accepted = new PlaygroundReprintClient($url, $state, $site);
    ob_start();
    try { $accepted->output_progress(['command' => 'files-pull', 'event' => 'stage', 'stage' => 'diff']); }
    finally { ob_end_clean(); }
    // Exactly 2 GiB is accepted despite the excluded backup and directory sizes.
}
