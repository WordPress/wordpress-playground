<?php
/**
 * Plugin Name: Playground Spacefast export adapter
 * Description: Lets Playground advance Simply Static exports without background loopback jobs.
 */
if (isset($_SERVER['HTTP_X_PLAYGROUND_SPACEFAST_CRAWL'])) {
    add_filter('determine_current_user', '__return_zero', PHP_INT_MAX);
    add_filter('show_admin_bar', '__return_false');
}

if (!defined('PLAYGROUND_SPACEFAST_EXPORT')) {
    return;
}

add_filter('ss_archive_creation_job_class', function () {
    class Playground_Spacefast_Archive_Job extends \Simply_Static\Archive_Creation_Job {
        public function dispatch() {
            // Playground calls tick explicitly, with a separate PHP request for each batch.
            return true;
        }

        public function should_continue() {
            return false;
        }

        public function tick() {
            $this->handle();
        }
    }
    return Playground_Spacefast_Archive_Job::class;
});

add_filter('simply_static_fetch_urls_batch_size', function () { return 20; });
// The normal crawl follows referenced core assets. Avoid also exporting every admin/editor asset.
add_filter('simply_static_crawlers', function ($crawlers) {
    return array_filter($crawlers, function ($crawler) {
        return $crawler->js_object()['id'] !== 'wp_includes';
    });
});
add_action('ss_completed', function ($status, $message = '') {
    update_option('playground_spacefast_export_result', array(
        'status' => $status,
        'message' => $message,
    ), false);
}, 10, 2);

// Serve the page rendered by Playground between batches. Never nest a PHP loopback request.
add_filter('pre_http_request', function ($pre, $args, $url) {
    $responses = is_file('/tmp/playground-spacefast-crawl.json')
        ? json_decode(file_get_contents('/tmp/playground-spacefast-crawl.json'), true) : array();
    $cache = $responses[$url] ?? null;
    if (!$cache) {
        return new WP_Error('spacefast_crawl_cache_miss', 'The export requested a page that has not been rendered.');
    }
    $body = file_get_contents($cache['bodyPath']);
    if (!empty($args['stream']) && !empty($args['filename'])) {
        file_put_contents($args['filename'], $body);
        $body = '';
    }
    return array(
        'response' => array('code' => $cache['status'], 'message' => ''),
        'headers' => $cache['headers'],
        'body' => $body,
        'cookies' => array(),
    );
}, PHP_INT_MAX, 3);

add_action('simply_static_page_file_transferred', function ($page) {
    $GLOBALS['playground_spacefast_exported_files'][] = $page->file_path;
});
