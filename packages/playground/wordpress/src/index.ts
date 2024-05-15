import { UniversalPHP } from '@php-wasm/universal';
import { joinPaths, phpVar } from '@php-wasm/util';
import { unzipFile } from '@wp-playground/common';

export * from './rewrite-rules';

/**
 * Preloads the platform mu-plugins from /internal/shared/mu-plugins.
 * This avoids polluting the WordPress installation with mu-plugins
 * that are only needed in the Playground environment.
 *
 * @param php
 */
export async function enablePlatformMuPlugins(php: UniversalPHP) {
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
}

export async function preloadRequiredMuPlugin(php: UniversalPHP) {
	// Entries must not render whitespaces. They'll be loaded
	// as mu-plugins and we don't want to trigger the "headers
	// already sent" PHP error.
	const specificMuPlugins = {
		addTrailingSlashToWpAdmin: `<?php
        // Redirect /wp-admin to /wp-admin/
        add_filter( 'redirect_canonical', function( $redirect_url ) {
            if ( '/wp-admin' === $redirect_url ) {
                return $redirect_url . '/';
            }
            return $redirect_url;
        } );
        ?>`,
		allowRedirectHosts: `<?php
        // Needed because gethostbyname( 'wordpress.org' ) returns
        // a private network IP address for some reason.
        add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
            return array(
                'wordpress.org',
                'api.wordpress.org',
                'downloads.wordpress.org',
            );
        } );
        ?>`,
		supportPermalinksWithoutIndexPhp: `<?php
        add_filter( 'got_url_rewrite', '__return_true' );
        ?>`,
		createFontsDirectory: `<?php
        // Create the fonts directory if missing
        if(!file_exists(WP_CONTENT_DIR . '/fonts')) {
            mkdir(WP_CONTENT_DIR . '/fonts');
        }
        ?>`,
		configureErrorLogging: `<?php
        $log_file = WP_CONTENT_DIR . '/debug.log';
        error_reporting(E_ALL);
        define('ERROR_LOG_FILE', $log_file);
        ini_set('error_log', $log_file);
        ini_set('ignore_repeated_errors', true);
        ini_set('display_errors', false);
        ini_set('log_errors', true);
        ?>`,
	};

	const playgroundMuPlugin = Object.values(specificMuPlugins)
		.map((p) => p.trim())
		.join('\n');
	await php.writeFile(
		'/internal/shared/mu-plugins/0-playground.php',
		playgroundMuPlugin
	);

	// Load the error handler before any other PHP file to ensure it
	// treats all errors, even those trigerred before mu-plugins are
	// loaded.
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
				 * This is a temporary workaround to hide the 32bit integer warnings that
				 * appear when using various time related function, such as strtotime and mktime.
				 * Examples of the warnings that are displayed:
				 *
				 * Warning: mktime(): Epoch doesn't fit in a PHP integer in <file>
				 * Warning: strtotime(): Epoch doesn't fit in a PHP integer in <file>
				 */
				if (strpos($message, "fit in a PHP integer") !== false) {
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
    if ( ${phpVar(requestPath)} === $_SERVER['REQUEST_URI'] ) {
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
	await php.mv(
		'/tmp/sqlite-database-integration/sqlite-database-integration-main',
		SQLITE_PLUGIN_FOLDER
	);
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
	const SQLITE_MUPLUGIN_PATH =
		'/internal/shared/mu-plugins/sqlite-database-integration.php';
	await php.writeFile(SQLITE_MUPLUGIN_PATH, dbPhp);
	await php.writeFile(
		`/internal/shared/preload/0-sqlite.php`,
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
$wpdb = $GLOBALS['wpdb'] = new Playground_SQLite_Integration_Loader();
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
