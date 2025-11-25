import type { PHP, UniversalPHP } from '@php-wasm/universal';
import { joinPaths, phpVar } from '@php-wasm/util';
import { unzipFile, createMemoizedFetch } from '@wp-playground/common';
import { logger } from '@php-wasm/logger';

export {
	bootWordPress,
	bootWordPressAndRequestHandler,
	bootRequestHandler,
	getFileNotFoundActionForWordPress,
} from './boot';
export type {
	PhpIniOptions,
	PHPInstanceCreatedHook,
	WordPressInstallMode,
} from './boot';
export { defineWpConfigConstants, ensureWpConfig } from './rewrite-wp-config';
export { getLoadedWordPressVersion } from './version-detect';

export * from './version-detect';
export * from './rewrite-rules';

/**
 * Preloads the platform mu-plugins from /internal/shared/mu-plugins.
 * This avoids polluting the WordPress installation with mu-plugins
 * that are only needed in the Playground environment.
 *
 * @param php
 */
export async function setupPlatformLevelMuPlugins(php: UniversalPHP) {
	await php.mkdir('/internal/shared/mu-plugins');
	await php.writeFile(
		'/internal/shared/preload/env.php',
		`<?php

        // Allow adding filters/actions prior to loading WordPress.
        // $function_to_add MUST be a string.
        function playground_add_filter( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
            global $wp_filter;
            $wp_filter[$tag][$priority][$function_to_add] = array('function' => $function_to_add, 'accepted_args' => $accepted_args);
        }
        function playground_add_action( $tag, $function_to_add, $priority = 10, $accepted_args = 1 ) {
            playground_add_filter( $tag, $function_to_add, $priority, $accepted_args );
        }

        // Load our mu-plugins after customer mu-plugins
        // NOTE: this means our mu-plugins can't use the muplugins_loaded action!
        playground_add_action( 'muplugins_loaded', 'playground_load_mu_plugins', 0 );
        function playground_load_mu_plugins() {
            // Load all PHP files from /internal/shared/mu-plugins, sorted by filename
            $mu_plugins_dir = '/internal/shared/mu-plugins';
            if(!is_dir($mu_plugins_dir)){
                return;
            }
            $mu_plugins = glob( $mu_plugins_dir . '/*.php' );
            sort( $mu_plugins );
            foreach ( $mu_plugins as $mu_plugin ) {
                require_once $mu_plugin;
            }
        }
    `
	);

	/**
	 * Automatically logs the user in to aid the login Blueprint step and
	 * the Playground runtimes.
	 *
	 * There are two ways to trigger the auto-login:
	 *
	 * ## The PLAYGROUND_AUTO_LOGIN_AS_USER constant
	 *
	 * Used by the login Blueprint step does.
	 *
	 * When the PLAYGROUND_AUTO_LOGIN_AS_USER constant is defined, this mu-plugin
	 * will automatically log the user in on their first visit. The username is
	 * the value of the constant.
	 *
	 * On subsequent visits, the playground_auto_login_already_happened cookie will be
	 * detected and the user will not be logged in. This means the "logout" feature
	 * will work as expected.
	 *
	 * ## The playground_force_auto_login_as_user GET parameter
	 *
	 * Used by the "login" button in various Playground runtimes.
	 *
	 * Only works if the PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED constant is defined.
	 *
	 * When the playground_force_auto_login_as_user GET parameter is present,
	 * this mu-plugin will automatically log in any logged out visitor. This will
	 * happen every time they visit, not just on their first visit.
	 *
	 *
	 * ## Context
	 *
	 * The login step used to make a HTTP request to the /wp-login.php endpoint,
	 * but that approach had significant downsides:
	 *
	 * * It only worked in web browsers
	 * * It didn't support custom login mechanisms
	 * * It required storing plaintext passwords in the Blueprint files
	 */
	await php.writeFile(
		'/internal/shared/mu-plugins/1-auto-login.php',
		`<?php
		/**
		 * Returns the username to auto-login as, if any.
		 * @return string|false
		 */
		function playground_get_username_for_auto_login() {
			/**
			 * Allow users to auto-login as a specific user on their first visit.
			 *
			 * Prevent the auto-login if it already happened by checking for the
			 * playground_auto_login_already_happened cookie.
			 * This is used to allow the user to logout.
			 */
			if ( defined('PLAYGROUND_AUTO_LOGIN_AS_USER') && !isset($_COOKIE['playground_auto_login_already_happened']) ) {
				return PLAYGROUND_AUTO_LOGIN_AS_USER;
			}
			/**
			 * Allow users to auto-login as a specific user by passing the
			 * playground_force_auto_login_as_user GET parameter.
			 */
			if ( defined('PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED') && isset($_GET['playground_force_auto_login_as_user']) ) {
				return $_GET['playground_force_auto_login_as_user'];
			}
			return false;
		}

		/**
		 * Logs the user in on their first visit if the Playground runtime told us to.
		 */
		function playground_auto_login() {
			/**
			 * The redirect should only run if the current PHP request is
			 * a HTTP request. If it's a PHP CLI run, we can't login the user
			 * because logins require cookies which aren't available in the CLI.
			 *
			 * Currently all Playground requests use the "cli" SAPI name
			 * to ensure support for WP-CLI, so the best way to distinguish
			 * between a CLI run and an HTTP request is by checking if the
			 * $_SERVER['REQUEST_URI'] global is set.
			 *
			 * If $_SERVER['REQUEST_URI'] is not set, we assume it's a CLI run.
			 */
			if (empty($_SERVER['REQUEST_URI'])) {
				return;
			}
			$user_name = playground_get_username_for_auto_login();
			if ( false === $user_name ) {
				return;
			}
			if (wp_doing_ajax() || defined('REST_REQUEST')) {
				return;
			}
			if ( is_user_logged_in() ) {
				return;
			}
			$user = get_user_by('login', $user_name);
			if (!$user) {
				return;
			}

			/**
			 * We're about to set cookies and redirect. It will log the user in
			 * if the headers haven't been sent yet.
			 *
			 * However, if they have been sent already – e.g. there a PHP
			 * notice was printed, we'll exit the script with a bunch of errors
			 * on the screen and without the user being logged in. This
			 * will happen on every page load and will effectively make Playground
			 * unusable.
			 *
			 * Therefore, we just won't auto-login if headers have been sent. Maybe
			 * we'll be able to finish the operation in one of the future requests
			 * or maybe not, but at least we won't end up with a permanent white screen.
			 */
			if (headers_sent()) {
				_doing_it_wrong('playground_auto_login', 'Headers already sent, the Playground runtime will not auto-login the user', '1.0.0');
				return;
			}

			/**
			 * This approach is described in a comment on
			 * https://developer.wordpress.org/reference/functions/wp_set_current_user/
			 */
			wp_set_current_user( $user->ID, $user->user_login );
			wp_set_auth_cookie( $user->ID );
			do_action( 'wp_login', $user->user_login, $user );

			setcookie('playground_auto_login_already_happened', '1');

			/**
			 * Confirm that nothing in WordPress, plugins, or filters have finalized
			 * the headers sending phase. See the comment above for more context.
			 */
			if (headers_sent()) {
				_doing_it_wrong('playground_auto_login', 'Headers already sent, the Playground runtime will not auto-login the user', '1.0.0');
				return;
			}

			/**
			 * Reload page to ensure the user is logged in correctly.
			 * WordPress uses cookies to determine if the user is logged in,
			 * so we need to reload the page to ensure the cookies are set.
			 */
			$redirect_url = $_SERVER['REQUEST_URI'];

			/**
			 * Intentionally do not use wp_redirect() here. It removes
			 * %0A and %0D sequences from the URL, which we don't want.
			 * There are valid use-cases for encoded newlines in the query string,
			 * for example html-api-debugger accepts markup with newlines
			 * encoded as %0A via the query string.
			 */
			header( "Location: $redirect_url", true, 302 );
			exit;
		}
		/**
		 * Autologin users from the wp-login.php page.
		 *
		 * The wp hook isn't triggered on
		 **/
		add_action('init', 'playground_auto_login', 1);

		/**
		 * Use an intermediate redirection step to ensure the login cookies
		 * are set before we redirecting to the landing page.
		 *
		 * /wp-admin/customize.php, and potentially other pages in WordPress,
		 * run authorization checks before running the init hook. If they're
		 * set as the landing page of the Blueprint, the user will be redirected
		 * to wp-login.php?reauth=1 before we have a chance to set the
		 * authorization cookie.
		 *
		 * To avoid this, we redirect to an intermediate page that will
		 * redirect the user to the landing page.
		 */
		function playground_auto_login_redirect_target() {
			if(strpos($_SERVER['REQUEST_URI'], '?playground-redirection-handler') !== false) {
				$next = $_GET['next'];
				header('Location: ' . $next, true, 302);
				exit;
			}
		}
		add_action('init', 'playground_auto_login_redirect_target', 1);

		/**
		 * Disable the Site Admin Email Verification Screen for any session started
		 * via autologin.
		 */
		add_filter('admin_email_check_interval', function($interval) {
			if(false === playground_get_username_for_auto_login()) {
				return 0;
			}
			return $interval;
		});
		`
	);

	await php.writeFile(
		'/internal/shared/mu-plugins/0-playground.php',
		`<?php
        // Needed because gethostbyname( 'wordpress.org' ) returns
        // a private network IP address for some reason.
        add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
            return array(
                'wordpress.org',
                'api.wordpress.org',
                'downloads.wordpress.org',
            );
        } );

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

        // Create the fonts directory if missing
        if(!file_exists(WP_CONTENT_DIR . '/fonts')) {
            mkdir(WP_CONTENT_DIR . '/fonts');
        }

        $log_file = WP_CONTENT_DIR . '/debug.log';
        define('ERROR_LOG_FILE', $log_file);
        ini_set('error_log', $log_file);
        ?>`
	);

	// Load the error handler before any other PHP file to ensure it
	// treats all the errors, even those trigerred before mu-plugins
	// are loaded.
	await php.writeFile(
		'/internal/shared/preload/error-handler.php',
		`<?php
		(function() {
			$playground_consts = [];
			if(file_exists('/internal/shared/consts.json')) {
				$playground_consts = @json_decode(file_get_contents('/internal/shared/consts.json'), true) ?: [];
				$playground_consts = array_keys($playground_consts);
			}
			set_error_handler(function($severity, $message, $file, $line) use($playground_consts) {
				/**
				 * Networking support in Playground registers a http_api_transports filter.
				 *
				 * This filter is deprecated, and no longer actively used, but is needed for wp_http_supports().
				 * @see https://core.trac.wordpress.org/ticket/37708
				 */
				if (
					strpos($message, "http_api_transports") !== false &&
					strpos($message, "since version 6.4.0 with no alternative available") !== false
				) {
					return;
				}
				/**
				 * Playground defines some constants upfront, and some of them may be redefined
				 * in wp-config.php. For example, SITE_URL or WP_DEBUG. This is expected and
				 * we want Playground constants to take priority without showing warnings like:
				 *
				 * Warning: Constant SITE_URL already defined in
				 */
				if (strpos($message, "already defined") !== false) {
					foreach($playground_consts as $const) {
						if(strpos($message, "Constant $const already defined") !== false) {
							return;
						}
					}
				}
				/**
				 * Don't complain about network errors when not connected to the network.
				 */
				if (
					(
						! defined('USE_FETCH_FOR_REQUESTS') ||
						! USE_FETCH_FOR_REQUESTS
					) &&
					strpos($message, "WordPress could not establish a secure connection to WordPress.org") !== false)
				{
					return;
				}
				return false;
			});
		})();`
	);
}

/**
 * Runs phpinfo() when the requested path is /phpinfo.php.
 */
export async function preloadPhpInfoRoute(
	php: UniversalPHP,
	requestPath = '/phpinfo.php'
) {
	await php.writeFile(
		'/internal/shared/preload/phpinfo.php',
		`<?php
    // Render PHPInfo if the requested page is /phpinfo.php
    if ( isset($_SERVER['REQUEST_URI']) && ${phpVar(
		requestPath
	)} === $_SERVER['REQUEST_URI'] ) {
        phpinfo();
        exit;
    }
    `
	);
}

export async function preloadSqliteIntegration(
	php: UniversalPHP,
	sqliteZip: File
) {
	if (await php.isDir('/tmp/sqlite-database-integration')) {
		await php.rmdir('/tmp/sqlite-database-integration', {
			recursive: true,
		});
	}
	await php.mkdir('/tmp/sqlite-database-integration');
	await unzipFile(php, sqliteZip, '/tmp/sqlite-database-integration');
	const SQLITE_PLUGIN_FOLDER = '/internal/shared/sqlite-database-integration';

	// The SQLite integration plugin was extracted into the sole subdirectory
	// of /tmp/sqlite-database-integration. Move it to SQLITE_PLUGIN_FOLDER.
	const temporarySqlitePluginFolder = `/tmp/sqlite-database-integration/${
		(await php.listFiles('/tmp/sqlite-database-integration'))[0]
	}`;
	await php.mv(temporarySqlitePluginFolder, SQLITE_PLUGIN_FOLDER);

	// Prevents the SQLite integration from trying to call activate_plugin()
	await php.defineConstant('SQLITE_MAIN_FILE', '1');
	const dbCopy = await php.readFileAsText(
		joinPaths(SQLITE_PLUGIN_FOLDER, 'db.copy')
	);
	const dbPhp = dbCopy
		.replace(
			"'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
			phpVar(SQLITE_PLUGIN_FOLDER)
		)
		.replace(
			"'{SQLITE_PLUGIN}'",
			phpVar(joinPaths(SQLITE_PLUGIN_FOLDER, 'load.php'))
		);
	const dbPhpPath = joinPaths(await php.documentRoot, 'wp-content/db.php');
	const stopIfDbPhpExists = `<?php
	// Do not preload this if WordPress comes with a custom db.php file.
	if(file_exists(${phpVar(dbPhpPath)})) {
		return;
	}
	?>`;
	const SQLITE_MUPLUGIN_PATH =
		'/internal/shared/mu-plugins/sqlite-database-integration.php';
	await php.writeFile(SQLITE_MUPLUGIN_PATH, stopIfDbPhpExists + dbPhp);
	await php.writeFile(
		`/internal/shared/preload/0-sqlite.php`,
		stopIfDbPhpExists +
			`<?php

/**
 * Loads the SQLite integration plugin before WordPress is loaded
 * and without creating a drop-in "db.php" file.
 *
 * Technically, it creates a global $wpdb object whose only two
 * purposes are to:
 *
 * * Exist – because the require_wp_db() WordPress function won't
 *           connect to MySQL if $wpdb is already set.
 * * Load the SQLite integration plugin the first time it's used
 *   and replace the global $wpdb reference with the SQLite one.
 *
 * This lets Playground keep the WordPress installation clean and
 * solves dillemas like:
 *
 * * Should we include db.php in Playground exports?
 * * Should we remove db.php from Playground imports?
 * * How should we treat stale db.php from long-lived OPFS sites?
 *
 * @see https://github.com/WordPress/wordpress-playground/discussions/1379 for
 *      more context.
 */
class Playground_SQLite_Integration_Loader {
	public function __call($name, $arguments) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		return call_user_func_array(
			array($GLOBALS['wpdb'], $name),
			$arguments
		);
	}
	public function __get($name) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		return $GLOBALS['wpdb']->$name;
	}
	public function __set($name, $value) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		$GLOBALS['wpdb']->$name = $value;
	}
    protected function load_sqlite_integration() {
        require_once ${phpVar(SQLITE_MUPLUGIN_PATH)};
    }
}
/**
 * The Query Monitor plugin short-circuits in the CLI SAPI. However, in Playground,
 * the SAPI is always "cli" at the moment. Let's set a constant to disable the CLI
 * detection.
 *
 * @see https://github.com/WordPress/sqlite-database-integration/pull/212
 * @see https://github.com/WordPress/sqlite-database-integration/pull/215
 */
define('QM_TESTS', true);
$wpdb = $GLOBALS['wpdb'] = new Playground_SQLite_Integration_Loader();

/**
 * WordPress is capable of using a preloaded global $wpdb. However, if
 * it cannot find the drop-in db.php plugin it still checks whether
 * the mysqli_connect() function exists even though it's not used.
 *
 * What WordPress demands, Playground shall provide.
 */
if(!function_exists('mysqli_connect')) {
	function mysqli_connect() {}
}

		`
	);
	/**
	 * Ensure the SQLite integration is loaded and clearly communicate
	 * if it isn't. This is useful because WordPress database errors
	 * may be cryptic and won't mention the SQLite integration.
	 */
	await php.writeFile(
		`/internal/shared/mu-plugins/sqlite-test.php`,
		`<?php
		global $wpdb;
		if(!($wpdb instanceof WP_SQLite_DB)) {
			var_dump(isset($wpdb));
			die("SQLite integration not loaded " . get_class($wpdb));
		}
		`
	);
}

/**
 * Prepare the WordPress document root given a WordPress zip file and
 * the sqlite-database-integration zip file.
 *
 * This is a TypeScript function for now, just to get something off the
 * ground, but it may be superseded by the PHP Blueprints library developed
 * at https://github.com/WordPress/blueprints-library/
 *
 * That PHP library will come with a set of functions and a CLI tool to
 * turn a Blueprint into a WordPress directory structure or a zip Snapshot.
 * Let's **not** invest in the TypeScript implementation of this function,
 * accept the limitation, and switch to the PHP implementation as soon
 * as that's viable.
 */
export async function unzipWordPress(php: PHP, wpZip: File) {
	php.mkdir('/tmp/unzipped-wordpress');
	await unzipFile(php, wpZip, '/tmp/unzipped-wordpress');

	// The zip file may contain another zip file if it's coming from GitHub
	// artifacts @TODO: Don't make so many guesses about the zip file contents.
	// Allow the API consumer to specify the exact "coordinates" of WordPress
	// inside the zip archive.
	if (php.fileExists('/tmp/unzipped-wordpress/wordpress.zip')) {
		await unzipFile(
			php,
			'/tmp/unzipped-wordpress/wordpress.zip',
			'/tmp/unzipped-wordpress'
		);
	}

	// The zip file may contain a subdirectory, or not.
	// @TODO: Don't make so many guesses about the zip file contents. Allow the
	//        API consumer to specify the exact "coordinates" of WordPress inside
	//        the zip archive.
	let wpPath = php.fileExists('/tmp/unzipped-wordpress/wordpress')
		? '/tmp/unzipped-wordpress/wordpress'
		: php.fileExists('/tmp/unzipped-wordpress/build')
		? '/tmp/unzipped-wordpress/build'
		: '/tmp/unzipped-wordpress';

	// Dive one directory deeper if the zip root does not contain the sample
	// config file. This is relevant when unzipping a zipped branch from the
	// https://github.com/WordPress/WordPress repository.
	if (!php.fileExists(joinPaths(wpPath, 'wp-config-sample.php'))) {
		// Still don't know the directory structure of the zip file.
		// 1. Get the first item in path.
		const files = php.listFiles(wpPath);
		if (files.length) {
			const firstDir = files[0];
			// 2. If it's a directory that contains wp-config-sample.php, use it.
			if (
				php.fileExists(
					joinPaths(wpPath, firstDir, 'wp-config-sample.php')
				)
			) {
				wpPath = joinPaths(wpPath, firstDir);
			}
		}
	}

	const moveRecursively = (source: string, target: string, php: PHP) => {
		if (php.isDir(source) && php.isDir(target)) {
			// We cannot move a directory over another directory,
			// so we move the children one by one.
			for (const file of php.listFiles(source)) {
				const sourcePath = joinPaths(source, file);
				const targetPath = joinPaths(target, file);
				moveRecursively(sourcePath, targetPath, php);
			}
		} else {
			if (php.fileExists(target)) {
				// Refuse to overwrite existing files to avoid the chance of data loss.
				const wpPath = source.replace(
					/^\/tmp\/unzipped-wordpress\//,
					'/'
				);
				logger.warn(
					`Cannot unzip WordPress files at ${target}: ${wpPath} already exists.`
				);
				return;
			}
			php.mv(source, target);
		}
	};
	moveRecursively(wpPath, php.documentRoot, php);
	// Remove any directories left because there were existing dirs at the target path.
	if (php.fileExists(wpPath)) {
		php.rmdir(wpPath, { recursive: true });
	}

	if (
		!php.fileExists(joinPaths(php.documentRoot, 'wp-config.php')) &&
		php.fileExists(joinPaths(php.documentRoot, 'wp-config-sample.php'))
	) {
		php.writeFile(
			joinPaths(php.documentRoot, 'wp-config.php'),
			php.readFileAsText(
				joinPaths(php.documentRoot, '/wp-config-sample.php')
			)
		);
	}
}

const memoizedFetch = createMemoizedFetch(fetch);

/**
 * Resolves a specific WordPress release URL and version string based on
 * a version query string such as "latest", "beta", or "6.6".
 *
 * Examples:
 * ```js
 * const { releaseUrl, version } = await resolveWordPressRelease('latest')
 * // becomes https://wordpress.org/wordpress-6.6.2.zip and '6.6.2'
 *
 * const { releaseUrl, version } = await resolveWordPressRelease('beta')
 * // becomes https://wordpress.org/wordpress-6.6.2-RC1.zip and '6.6.2-RC1'
 *
 * const { releaseUrl, version } = await resolveWordPressRelease('6.6')
 * // becomes https://wordpress.org/wordpress-6.6.2.zip and '6.6.2'
 * ```
 *
 * @param versionQuery - The WordPress version query string to resolve.
 * @returns The resolved WordPress release URL and version string.
 */
const WORDPRESS_TRUNK_ZIP_URL =
	'https://github.com/WordPress/WordPress/archive/refs/heads/master.zip';

export async function resolveWordPressRelease(versionQuery = 'latest') {
	if (versionQuery === null) {
		versionQuery = 'latest';
	} else if (
		versionQuery.startsWith('https://') ||
		versionQuery.startsWith('http://')
	) {
		const shasum = await crypto.subtle.digest(
			'SHA-1',
			new TextEncoder().encode(versionQuery)
		);
		const sha1 = Array.from(new Uint8Array(shasum))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
		return {
			releaseUrl: versionQuery,
			version: 'custom-' + sha1.substring(0, 8),
			source: 'inferred',
		};
	} else if (versionQuery === 'trunk' || versionQuery === 'nightly') {
		const cacheBust = new Date().toISOString().split('T')[0];
		return {
			releaseUrl: `${WORDPRESS_TRUNK_ZIP_URL}?ts=${cacheBust}`,
			version: 'trunk',
			source: 'inferred',
		};
	}

	const response = await memoizedFetch(
		'https://api.wordpress.org/core/version-check/1.7/?channel=beta'
	);
	let latestVersions = await response.json();

	latestVersions = latestVersions.offers.filter(
		(v: any) => v.response === 'autoupdate'
	);

	for (const apiVersion of latestVersions) {
		if (
			versionQuery === 'beta' &&
			(apiVersion.version.includes('beta') ||
				apiVersion.version.includes('RC'))
		) {
			return {
				releaseUrl: apiVersion.download,
				version: apiVersion.version,
				source: 'api',
			};
		} else if (
			versionQuery === 'latest' &&
			!apiVersion.version.includes('beta') &&
			!apiVersion.version.includes('RC')
		) {
			// The first non-beta item in the list is the latest version.
			return {
				releaseUrl: apiVersion.download,
				version: apiVersion.version,
				source: 'api',
			};
		} else if (
			apiVersion.version.substring(0, versionQuery.length) ===
			versionQuery
		) {
			return {
				releaseUrl: apiVersion.download,
				version: apiVersion.version,
				source: 'api',
			};
		}
	}

	/**
	 * Replace "6.8.0" with "6.8" to support installing the exact "6.8.0" release.
	 *
	 * The remote release ZIP file URL for 6.8.0 is `https://wordpress.org/wordpress-6.8.zip`.
	 * However, we already resolve `6.8` to the latest patch version, so that's not an option.
	 * Therefore, version "6.8.0" can be resolved by requesting a version string "6.8.0", which
	 * we then convert to "6.8" to construct the correct remote ZIP file URL.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/issues/2749
	 */
	if (versionQuery.match(/^\d+\.\d+\.0$/)) {
		versionQuery = versionQuery.split('.').slice(0, 2).join('.');
	}

	return {
		releaseUrl: `https://wordpress.org/wordpress-${versionQuery}.zip`,
		version: versionQuery,
		source: 'inferred',
	};
}
