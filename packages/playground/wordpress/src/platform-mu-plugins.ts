import type { UniversalPHP } from '@php-wasm/universal';

/**
 * Writes the Playground platform mu-plugins that run on every
 * supported PHP/WordPress combination — 0-playground.php,
 * sitemap-redirect.php, inline-tinymce-content-css.php.
 *
 * Both {@link setupPlatformLevelMuPlugins} (modern path) and
 * {@link setupLegacyPlatformLevelMuPlugins} call this to avoid
 * duplicating ~200 lines of identical PHP strings.
 */
export async function writeCommonPlatformMuPlugins(
	php: UniversalPHP
): Promise<void> {
	await php.writeFile(
		'/internal/shared/mu-plugins/0-playground.php',
		`<?php

		// Save WordPress environment information to a file.
		// Named function (not a closure) so this file parses on PHP 5.2.
		function playground_save_wp_env_info() {
			if (defined('DB_ENGINE') && DB_ENGINE === 'sqlite') {
				$db_info = array(
					'type' => 'sqlite',
					'path' => FQDB,
					'driver_path' => defined('WP_MYSQL_ON_SQLITE_LOADER_PATH')
						? WP_MYSQL_ON_SQLITE_LOADER_PATH
						: dirname(SQLITE_MAIN_FILE) . '/wp-pdo-mysql-on-sqlite.php',
				);
			} else {
				$db_info = array(
					'type' => 'mysql',
					// TODO: Save MySQL connection config.
				);
			}
			$wp_env = array('db' => $db_info);
			$wp_env_php = sprintf('<?php return %s;', var_export($wp_env, true));
			$wp_env_file = '/internal/shared/wp-env.php';
			if (!file_exists($wp_env_file) || file_get_contents($wp_env_file) !== $wp_env_php ) {
				file_put_contents($wp_env_file, $wp_env_php);
			}
		}
		add_action('wp_loaded', 'playground_save_wp_env_info');

        // Needed because gethostbyname( 'wordpress.org' ) returns
        // a private network IP address for some reason.
        function playground_allowed_redirect_hosts( $deprecated = '' ) {
            return array(
                'wordpress.org',
                'api.wordpress.org',
                'downloads.wordpress.org',
            );
        }
        add_filter( 'allowed_redirect_hosts', 'playground_allowed_redirect_hosts' );

		/**
		 * Prevents wp_http_validate_url() from universally failing.
		 *
		 * wp_http_validate_url() calls gethostbyname() to verify whether the host
		 * is external. If it is internal, the URL validation fails and WordPress
		 * refuses to make a request.
		 *
		 * However, in EMscripten, gethostbyname() returns a private network IP address.
		 * This causes wp_http_validate_url() to return false for all URLs.
		 *
		 * This filter ensures that all URLs are considered external. In production
		 * environments, this would be considered a security risk. However, Playground
		 * already provides multiple code execution vectors as features (e.g. Blueprints).
		 *
		 * If someone wants to poke around local IP addresses, they already have multiple
		 * tools at their disposal. Therefore, this is not a real security risk in context
		 * of WordPress Playground or Playground CLI.
		 */
		add_filter('http_request_host_is_external', '__return_true');

		// Support pretty permalinks
        add_filter( 'got_url_rewrite', '__return_true' );

		/**
		 * Flush rewrite rules on the first real WordPress request.
		 *
		 * During boot, we set permalink_structure in the database
		 * but can't flush rewrite rules at that point because WordPress
		 * isn't fully bootstrapped — post types and taxonomies haven't
		 * been registered yet, so the generated rules are incomplete.
		 *
		 * This hook fires on 'init' at a very late priority, after all
		 * post types and taxonomies are registered. It checks if the
		 * rewrite_rules option is empty (meaning rules were never
		 * flushed) and if permalink_structure is set, then flushes once.
		 * A flag file prevents repeated flushes on subsequent requests.
		 */
		function playground_maybe_flush_rewrite_rules() {
			$flag = '/internal/shared/.rewrite-rules-flushed';
			if (file_exists($flag)) {
				return;
			}
			if (!function_exists('get_option')) {
				return;
			}
			$structure = get_option('permalink_structure');
			if (empty($structure)) {
				return;
			}
			$rules = get_option('rewrite_rules');
			if (!empty($rules)) {
				@file_put_contents($flag, '1');
				return;
			}
			global $wp_rewrite;
			if (!isset($wp_rewrite) && class_exists('WP_Rewrite')) {
				$wp_rewrite = new WP_Rewrite();
			}
			if (isset($wp_rewrite) && method_exists($wp_rewrite, 'flush_rules')) {
				$wp_rewrite->flush_rules();
			}
			@file_put_contents($flag, '1');
		}
		add_action('init', 'playground_maybe_flush_rewrite_rules', 99999);

        // Create the fonts directory if missing
        if(!file_exists(WP_CONTENT_DIR . '/fonts')) {
            mkdir(WP_CONTENT_DIR . '/fonts');
        }

        $log_file = WP_CONTENT_DIR . '/debug.log';
        if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
            if ( is_string( WP_DEBUG_LOG ) ) {
                $log_file = WP_DEBUG_LOG;
            }
            ini_set('error_log', $log_file);
        } else {
            ini_set('log_errors', '0');
        }
        define('ERROR_LOG_FILE', $log_file);
        ?>`
	);

	/**
	 * WordPress 6.7+ only generates the sitemap.xml → wp-sitemap.xml rewrite
	 * rule when installed at the domain root. Since Playground may use non-root
	 * installations, the rule isn't generated. This mu-plugin handles the
	 * redirect manually by using the site URL to determine the correct base path.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/issues/2051
	 */
	await php.writeFile(
		'/internal/shared/mu-plugins/sitemap-redirect.php',
		`<?php
		/**
		 * Redirect sitemap.xml to wp-sitemap.xml for non-root installations.
		 *
		 * WordPress seems to only generate the sitemap.xml → wp-sitemap.xml rewrite
		 * rule when installed at the domain root. This mu-plugin handles the
		 * redirect for non-root installations.
		 */
		if (isset($_SERVER['REQUEST_URI'])) {
			$site_url = site_url();
			$parsed = parse_url($site_url);
			$base_path = isset($parsed['path']) ? rtrim($parsed['path'], '/') : '';

			$request_uri = $_SERVER['REQUEST_URI'];
			if (
				$request_uri === $base_path . '/sitemap.xml' ||
				strpos($request_uri, $base_path . '/sitemap.xml?') === 0 ||
				strpos($request_uri, $base_path . '/sitemap.xml/') === 0
			) {
				$query_string = strpos($request_uri, '?') !== false ? substr($request_uri, strpos($request_uri, '?')) : '';
				header('Location: ' . $base_path . '/wp-sitemap.xml' . $query_string, true, 301);
				exit;
			}
		}
		`
	);

	// TinyMCE's editor iframe uses document.open(), which creates a
	// document not controlled by the service worker. Sub-resource
	// requests from it (content_css) bypass the SW and 404.
	// Inline the CSS via content_style so no network request is needed.
	await php.writeFile(
		'/internal/shared/mu-plugins/inline-tinymce-content-css.php',
		`<?php
		function playground_inline_tinymce_content_css($settings) {
			if (empty($settings['content_css'])) return $settings;
			$css_urls = explode(',', $settings['content_css']);
			$inline_css = '';
			$doc_root = isset($_SERVER['DOCUMENT_ROOT'])
				? $_SERVER['DOCUMENT_ROOT'] : '/wordpress';
			foreach ($css_urls as $url) {
				$url = trim($url);
				if (!$url) continue;
				$parsed = parse_url($url);
				if (!isset($parsed['path'])) continue;
				$path = preg_replace('#^/scope:[^/]+#', '', $parsed['path']);
				$file = $doc_root . $path;
				if (file_exists($file)) {
					$inline_css .= @file_get_contents($file) . "\\n";
				}
			}
			if ($inline_css !== '') {
				if (!empty($settings['content_style'])) {
					$inline_css = $settings['content_style'] . "\\n" . $inline_css;
				}
				$settings['content_style'] = $inline_css;
				$settings['content_css'] = '';
			}
			return $settings;
		}
		add_filter('tiny_mce_before_init', 'playground_inline_tinymce_content_css');
		`
	);
}
