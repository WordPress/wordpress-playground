import type {
	CookieStore,
	FileNotFoundAction,
	FileNotFoundGetActionCallback,
	FileTree,
	PathAlias,
	PHPWorker,
	SpawnHandler,
	Remote,
} from '@php-wasm/universal';
import {
	PHP,
	PHPRequestHandler,
	sandboxedSpawnHandlerFactory,
	setPhpIniEntries,
	withPHPIniValues,
	writeFiles,
} from '@php-wasm/universal';
import {
	preloadPhpInfoRoute,
	setupPlatformLevelMuPlugins,
	preloadSqliteIntegration,
	unzipWordPress,
	wordPressRewriteRules,
} from '.';
import { basename, dirname, joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import { ensureWpConfig, defineWpConfigConstants } from './wp-config';

export type PhpIniOptions = Record<string, string>;
export type Hook = (php: PHP) => void | Promise<void>;
export interface Hooks {
	beforeWordPressFiles?: Hook;
	beforeDatabaseSetup?: Hook;
}

export type PHPInstanceCreatedHook = (
	php: PHP,
	{ isPrimary }: { isPrimary: boolean }
) => Promise<void>;

export type DatabaseType = 'sqlite' | 'mysql' | 'custom';

export async function bootWordPressAndRequestHandler(
	options: BootRequestHandlerOptions & BootWordPressOptions
) {
	const requestHandler = await bootRequestHandler(options);
	await bootWordPress(requestHandler, options);
	return requestHandler;
}

export interface BootRequestHandlerOptions {
	createPhpRuntime: (isPrimary?: boolean) => Promise<number>;
	onPHPInstanceCreated?: PHPInstanceCreatedHook;
	maxPhpInstances?: number;
	/**
	 * PHP SAPI name to be returned by get_sapi_name(). Overriding
	 * it is useful for running programs that check for this value,
	 * e.g. WP-CLI
	 */
	sapiName?: string;
	/**
	 * URL to use as the site URL. This is used to set the WP_HOME
	 * and WP_SITEURL constants in WordPress.
	 */
	siteUrl: string;
	documentRoot?: string;
	spawnHandler?: (
		getPHPInstance?: () => Promise<{
			php: PHP | Remote<PHPWorker>;
			reap: () => void;
		}>
	) => SpawnHandler;
	/**
	 * PHP.ini entries to define before running any code. They'll
	 * be used for all requests.
	 */
	phpIniEntries?: PhpIniOptions;
	/**
	 * PHP constants to define for every request.
	 */
	constants?: Record<string, string | number | boolean | null>;
	/**
	 * Files to create in the filesystem before any mounts are applied.
	 *
	 * Example:
	 *
	 * ```ts
	 * {
	 * 		createFiles: {
	 * 			'/tmp/hello.txt': 'Hello, World!',
	 * 			'/internal/preload': {
	 * 				'1-custom-mu-plugin.php': '<?php echo "Hello, World!";',
	 * 			}
	 * 		}
	 * }
	 * ```
	 */
	createFiles?: FileTree;

	/**
	 * A callback that decides how to handle a file-not-found condition for a
	 * given request URI.
	 */
	getFileNotFoundAction?: FileNotFoundGetActionCallback;

	/**
	 * Path aliases that map URL prefixes to filesystem paths outside
	 * the document root. Similar to Nginx's `alias` directive.
	 *
	 * @example
	 * ```ts
	 * pathAliases: [
	 *   { urlPrefix: '/phpmyadmin', fsPath: '/tools/phpmyadmin' }
	 * ]
	 * ```
	 */
	pathAliases?: PathAlias[];

	/**
	 * The CookieStore instance to use.
	 *
	 * If not provided, Playground will use the HttpCookieStore by default.
	 * The HttpCookieStore persists cookies in an internal store and includes
	 * them in following requests.
	 *
	 * If you don't want Playground to handle cookies, set the cookie store
	 * to `false`. This is useful for the Node version of Playground, where
	 * cookies can be handled by the browser.
	 *
	 * You can also provide a custom CookieStore implementation by implementing
	 * the CookieStore interface.
	 */
	cookieStore?: CookieStore | false;
}

export type WordPressInstallMode =
	| 'download-and-install'
	| 'install-from-existing-files'
	| 'install-from-existing-files-if-needed'
	| 'do-not-attempt-installing';

export interface BootWordPressOptions {
	/**
	 * Mounting and Copying is handled via hooks for starters.
	 *
	 * In the future we could standardize the
	 * browser-specific and node-specific mounts
	 * in the future.
	 */
	hooks?: Hooks;
	/** SQL file to load instead of installing WordPress. */
	dataSqlPath?: string;
	/** How to handle WordPress installation. */
	wordpressInstallMode?: WordPressInstallMode;
	/** Zip with the WordPress installation to extract in /wordpress. */
	wordPressZip?: File | Promise<File> | undefined;
	/** Preloaded SQLite integration plugin. */
	sqliteIntegrationPluginZip?: File | Promise<File>;
	/**
	 * When set, WordPress will connect to a MySQL proxy at
	 * 127.0.0.1:<port> instead of using the SQLite db.php drop-in.
	 *
	 * This is used for PHP 5.6, which can't run the modern
	 * sqlite-database-integration plugin directly. A separate
	 * PHP 8.x instance runs the query translation behind a
	 * MySQL wire protocol proxy.
	 */
	mysqlProxyPort?: number;
	/**
	 * PHP constants to define for every request.
	 */
	constants?: Record<string, string | number | boolean | null>;
	/**
	 * PHP.ini entries to define before running any code. They'll
	 * be used for all requests.
	 */
	phpIniEntries?: PhpIniOptions;
	/**
	 * Files to create in the filesystem before any mounts are applied.
	 *
	 * Example:
	 *
	 * ```ts
	 * {
	 * 		createFiles: {
	 * 			'/tmp/hello.txt': 'Hello, World!',
	 * 			'/internal/preload': {
	 * 				'1-custom-mu-plugin.php': '<?php echo "Hello, World!";',
	 * 			}
	 * 		}
	 * }
	 * ```
	 */
	createFiles?: FileTree;
	/**
	 * URL to use as the site URL. This is used to set the WP_HOME
	 * and WP_SITEURL constants in WordPress.
	 */
	siteUrl: string;
}

/**
 * Boots a WordPress instance with the given options.
 *
 * High-level overview:
 *
 * * Boot PHP instances and PHPRequestHandler
 * * Setup VFS, run beforeWordPressFiles hook
 * * Setup WordPress files (if wordPressZip is provided)
 * * Run beforeDatabaseSetup hook
 * * Setup the database – SQLite, MySQL (@TODO), or rely on a mounted database
 * * Run WordPress installer, if the site isn't installed yet
 *
 * @param options Boot configuration options
 * @return PHPRequestHandler instance with WordPress installed.
 */
export async function bootWordPress(
	requestHandler: PHPRequestHandler,
	options: BootWordPressOptions
) {
	const php = await requestHandler.getPrimaryPhp();
	if (options.hooks?.beforeWordPressFiles) {
		await options.hooks.beforeWordPressFiles(php);
	}

	if (options.wordPressZip) {
		await unzipWordPress(php, await options.wordPressZip);
	}

	if (options.constants) {
		for (const key in options.constants) {
			php.defineConstant(key, options.constants[key]);
		}
	}

	if (options.dataSqlPath) {
		php.defineConstant('DB_DIR', dirname(options.dataSqlPath));
		php.defineConstant('DB_FILE', basename(options.dataSqlPath));
	}

	/**
	 * WordPress versions before 2.6 don't have wp-load.php.
	 * They use a completely different file structure and installation
	 * process. For these legacy versions, we use a separate boot path
	 * that handles the multi-step installer and sets up PHP compat shims
	 * for old superglobals like $HTTP_GET_VARS.
	 */
	const isLegacyWordPress = !php.fileExists(
		joinPaths(php.documentRoot, 'wp-load.php')
	);

	if (isLegacyWordPress) {
		await bootLegacyWordPress(php, requestHandler, options);
		return requestHandler;
	}

	php.defineConstant('WP_HOME', options.siteUrl);
	php.defineConstant('WP_SITEURL', options.siteUrl);

	/*
	 * Add required constants to "wp-config.php" if they are not already defined.
	 * This is needed, because some WordPress backups and exports may not include
	 * definitions for some of the necessary constants.
	 */
	await ensureWpConfig(php, requestHandler.documentRoot);
	// Run "before database" hooks to mount/copy more files in
	if (options.hooks?.beforeDatabaseSetup) {
		await options.hooks.beforeDatabaseSetup(php);
	}

	// @TODO Assert WordPress core files are in place

	let usesSqlite = false;
	const usesMysqlProxy = !!options.mysqlProxyPort;
	if (usesMysqlProxy) {
		/**
		 * When a MySQL proxy is configured, WordPress connects to it
		 * via standard MySQL functions (mysqli). No db.php drop-in
		 * is needed. This is used for PHP 5.6 where the modern
		 * sqlite-database-integration plugin can't run directly.
		 */
		usesSqlite = true;
		await configureWordPressForMySQLProxy(
			php,
			requestHandler.documentRoot,
			options.mysqlProxyPort!
		);
	} else if (options.sqliteIntegrationPluginZip) {
		usesSqlite = true;
		await preloadSqliteIntegration(
			php,
			await options.sqliteIntegrationPluginZip
		);
	}

	const installationMode =
		options['wordpressInstallMode'] ?? 'download-and-install';
	const hasCustomDatabasePath = !!options.dataSqlPath;

	if (
		['download-and-install', 'install-from-existing-files'].includes(
			installationMode
		)
	) {
		// Check database prerequisites before attempting installation
		await assertDatabasePrerequisites(requestHandler, {
			usesSqlite,
			hasCustomDatabasePath,
		});
		// Install WordPress if it's not installed.
		try {
			await installWordPress(php);
		} catch (error) {
			// If installation failed, check if it's a database issue
			// to provide a more specific error message (but skip if user provided custom DB path)
			if (!hasCustomDatabasePath) {
				await assertValidDatabaseConnection(requestHandler);
			}
			// If we get here, the database is valid but installation failed for another reason
			throw error;
		}
		// Validate the database connection after installation (skip if user provided custom DB path)
		if (!hasCustomDatabasePath) {
			await assertValidDatabaseConnection(requestHandler);
		}
	} else if ('install-from-existing-files-if-needed' === installationMode) {
		// Check database prerequisites before attempting installation
		await assertDatabasePrerequisites(requestHandler, {
			usesSqlite,
			hasCustomDatabasePath,
		});
		if (!(await isWordPressInstalled(php))) {
			// Install WordPress if it's not installed.
			try {
				await installWordPress(php);
			} catch (error) {
				// If installation failed, check if it's a database issue
				// to provide a more specific error message (but skip if user provided custom DB path)
				if (!hasCustomDatabasePath) {
					await assertValidDatabaseConnection(requestHandler);
				}
				// If we get here, the database is valid but installation failed for another reason
				throw error;
			}
		}
		// Validate the database connection after installation (skip if user provided custom DB path)
		if (!hasCustomDatabasePath) {
			await assertValidDatabaseConnection(requestHandler);
		}
	}

	return requestHandler;
}

/**
 * Checks if database prerequisites are in place before attempting WordPress installation.
 * This performs lightweight checks that don't require WordPress to be installed.
 */
async function assertDatabasePrerequisites(
	requestHandler: PHPRequestHandler,
	{
		usesSqlite,
		hasCustomDatabasePath,
	}: {
		usesSqlite: boolean;
		hasCustomDatabasePath: boolean;
	}
) {
	const php = await requestHandler.getPrimaryPhp();

	// If a MySQL proxy is configured (usesSqlite is true in that case),
	// the database is handled through the proxy. Skip further checks.
	if (php.isFile('/internal/shared/preload/0-sqlite.php')) {
		return;
	}

	// Check if a SQLite integration plugin directory exists (even if not provided via zip)
	// This handles cases where the directory is mounted via hooks
	const sqlitePluginPath = joinPaths(
		requestHandler.documentRoot,
		'wp-content/mu-plugins/sqlite-database-integration'
	);

	if (php.isDir(sqlitePluginPath)) {
		// The directory exists, we'll validate it after WordPress is installed
		return;
	}

	// Check if we provided a SQLite integration zip
	if (usesSqlite) {
		// We provided a zip, so SQLite will be set up during boot
		return;
	}

	// If we have a custom database path (dataSqlPath option was provided),
	// assume it's configured - the actual connection will be validated after installation
	if (hasCustomDatabasePath) {
		return;
	}

	// No SQLite integration and no MySQL support available
	// Throw early to avoid attempting installation with no database
	throw new Error('Error connecting to the MySQL database.');
}

async function assertValidDatabaseConnection(
	requestHandler: PHPRequestHandler
) {
	const php = await requestHandler.getPrimaryPhp();
	// Check if the database connection (MySQL or SQLite) is up and running.
	const validConnection = await isDatabaseConnectionValid(php);
	if (validConnection) {
		return;
	}

	if (php.isFile('/internal/shared/preload/0-sqlite.php')) {
		// The core SQLite integration has been installed, but the database connection is not valid.
		throw new Error('Error connecting to the SQLite database.');
	}

	// Check if a SQLite integration plugin directory exists (even if not provided via zip)
	// This handles cases where the directory is mounted via hooks
	const sqlitePluginPath = joinPaths(
		requestHandler.documentRoot,
		'wp-content/mu-plugins/sqlite-database-integration'
	);

	if (php.isDir(sqlitePluginPath)) {
		// The mu-plugin directory exists, but the database connection is not valid.
		throw new Error('Error connecting to the SQLite database.');
	}

	// 1. No core SQLite integration has been installed.
	// 2. No SQLite integration plugin directory exists.
	// The MySQL database connection is not valid.
	throw new Error('Error connecting to the MySQL database.');
}

export async function bootRequestHandler(options: BootRequestHandlerOptions) {
	const createSpawnHandler =
		options.spawnHandler ?? sandboxedSpawnHandlerFactory;
	async function createPhp(
		requestHandler?: PHPRequestHandler,
		isPrimary = false
	) {
		const runtimeId = await options.createPhpRuntime(isPrimary);
		const php = new PHP(runtimeId);
		if (options.sapiName) {
			php.setSapiName(options.sapiName);
		}
		if (requestHandler) {
			php.requestHandler = requestHandler;
		}
		if (options.phpIniEntries) {
			setPhpIniEntries(php, options.phpIniEntries);
		}

		// Use the new AST-based SQLite driver.
		// TODO: Remove this once the new driver is the default; when this is closed:
		//         https://github.com/WordPress/sqlite-database-integration/issues/195
		php.defineConstant('WP_SQLITE_AST_DRIVER', true);

		// Define any custom constants provided via CLI or configuration
		if (options.constants) {
			for (const key in options.constants) {
				php.defineConstant(key, options.constants[key]);
			}
		}

		/**
		 * Set up mu-plugins in /internal/mu-plugins
		 * using auto_prepend_file to provide platform-level
		 * customization without altering the installed WordPress
		 * site.
		 *
		 * We only do that in the primary PHP instance –
		 * the filesystem there is the source of truth
		 * for all other PHP instances.
		 */
		if (
			isPrimary &&
			/**
			 * Only the first PHP instance of the first worker created
			 * during WordPress boot writes these files – otherwise we'll keep
			 * overwriting them with concurrent writers living in other worker
			 * threads.
			 *
			 * The `.boot-files-written` file is our primitive synchronization
			 * mechanism. It works, because secondary workers are only booted
			 * once the primary worker has fully booted.
			 */
			!php.isFile('/internal/.boot-files-written')
		) {
			// TODO: There is a race here when multiple workers are calling bootRequestHandler(). Fix it.
			await setupPlatformLevelMuPlugins(php);
			await writeFiles(php, '/', options.createFiles || {});
			await preloadPhpInfoRoute(
				php,
				joinPaths(new URL(options.siteUrl).pathname, 'phpinfo.php')
			);
			await writeFiles(php, '/internal', {
				'.boot-files-written': '',
			});
		}

		// Spawn handler is responsible for spawning processes for all the
		// `popen()`, `proc_open()` etc. calls.
		if (createSpawnHandler) {
			await php.setSpawnHandler(
				createSpawnHandler(
					requestHandler
						? () =>
								requestHandler.instanceManager.acquirePHPInstance()
						: undefined
				)
			);
		}

		// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
		// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
		php.enableRuntimeRotation({
			recreateRuntime: options.createPhpRuntime,
			maxRequests: 400,
		});

		if (options.onPHPInstanceCreated) {
			await options.onPHPInstanceCreated(php, { isPrimary });
		}

		return php;
	}

	const requestHandler: PHPRequestHandler = new PHPRequestHandler({
		documentRoot: options.documentRoot || '/wordpress',
		absoluteUrl: options.siteUrl,
		rewriteRules: wordPressRewriteRules,
		pathAliases: options.pathAliases,
		getFileNotFoundAction:
			options.getFileNotFoundAction ?? getFileNotFoundActionForWordPress,
		cookieStore: options.cookieStore,

		/**
		 * If maxPhpInstances is 1, the PHPRequestHandler constructor needs
		 * a PHP instance. Internally, it creates a SinglePHPInstanceManager
		 * and uses the same PHP instance to handle all requests.
		 */
		php:
			options.maxPhpInstances === 1
				? await createPhp(undefined, true)
				: undefined,

		/**
		 * If maxPhpInstances is not 1, the PHPRequestHandler constructor needs
		 * a PHP factory function. Internally, it creates a PHPProcessManager that
		 * maintains a pool of reusable PHP instances.
		 */
		phpFactory:
			options.maxPhpInstances !== 1
				? async ({ isPrimary }) => createPhp(requestHandler, isPrimary)
				: (undefined as any),
		maxPhpInstances: options.maxPhpInstances,
	});

	return requestHandler;
}

/**
 * Checks if WordPress is installed by checking if the wp-load.php file exists
 * and if the blog is installed.
 *
 * @param php - The PHP instance to check.
 * @returns True if WordPress is installed, false otherwise.
 */
export async function isWordPressInstalled(php: PHP) {
	const result = await php.run({
		code: `<?php
			ob_start();
			$wp_load = getenv('DOCUMENT_ROOT') . '/wp-load.php';
			if (!file_exists($wp_load)) {
				echo '-1';
				exit;
			}
			require $wp_load;
			ob_clean();
			echo is_blog_installed() ? '1' : '0';
			ob_end_flush();
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
		},
	});
	return result.text === '1';
}

/**
 * Runs the WordPress installation wizard.
 *
 * Before running the installer this function disables networking
 * to avoid loopback requests and also speed it up.
 *
 * These PHP.ini make for a *major speed improvement*.
 * Without them, the installer may take 60 seconds,
 * 300 seconds, or even more to complete.
 */
async function installWordPress(php: PHP) {
	const response = await withPHPIniValues(
		php,
		{
			disable_functions: 'fsockopen',
			allow_url_fopen: '0',
		},
		async () =>
			await php.request({
				url: '/wp-admin/install.php?step=2',
				method: 'POST',
				body: {
					language: 'en',
					prefix: 'wp_',
					weblog_title: 'My WordPress Website',
					user_name: 'admin',
					admin_password: 'password',
					// The installation wizard demands typing the same password twice
					admin_password2: 'password',
					Submit: 'Install WordPress',
					pw_weak: '1',
					admin_email: 'admin@localhost.com',
				},
			})
	);

	if (!(await isWordPressInstalled(php))) {
		throw new Error(
			`Failed to install WordPress – installer responded with "${response.text?.substring(
				0,
				100
			)}"`
		);
	}

	const defaultedToPrettyPermalinks = await php.run({
		code: `<?php
			ob_start();
			$wp_load = getenv('DOCUMENT_ROOT') . '/wp-load.php';
			if (!file_exists($wp_load)) {
				echo '0';
				exit;
			}
			require $wp_load;
			$nice_permalinks = '/%year%/%monthnum%/%day%/%postname%/';
			$option_result = update_option(
				'permalink_structure',
				$nice_permalinks
			);
			ob_clean();
			if ( get_option( 'permalink_structure' ) === $nice_permalinks ) {
				echo '1';
			} else {
				echo '0';
			}
			ob_end_flush();
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
		},
	});

	if (defaultedToPrettyPermalinks.text !== '1') {
		logger.warn('Failed to default to pretty permalinks after WP install.');
	}
}

export function getFileNotFoundActionForWordPress(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- maintain consistent FileNotFoundGetActionCallback signature
	relativeUri: string
): FileNotFoundAction {
	// Delegate unresolved requests to WordPress. This makes WP magic possible,
	// like pretty permalinks and dynamically generated sitemaps.
	return {
		type: 'internal-redirect',
		uri: '/index.php',
	};
}

async function isDatabaseConnectionValid(php: PHP) {
	const result = await php.run({
		code: `<?php
			ob_start();
			$wp_load = getenv('DOCUMENT_ROOT') . '/wp-load.php';
			if (!file_exists($wp_load)) {
				echo '-1';
				exit;
			}
			require $wp_load;
			ob_clean();
			echo $wpdb->check_connection( false ) ? '1' : '0';
			ob_end_flush();
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
		},
	});
	return result.text === '1';
}

/**
 * Boots a legacy WordPress version (pre-2.6, no wp-load.php).
 *
 * Legacy WordPress versions like 1.0 have a completely different
 * file structure, installation process, and PHP API surface:
 *
 * - No wp-load.php (introduced in WP 2.6)
 * - Multi-step installer (steps 1, 2, 3 instead of a single POST)
 * - Uses old PHP superglobals ($HTTP_GET_VARS, $HTTP_POST_VARS)
 *   that were removed in PHP 5.4
 * - Uses the old mysql_* extension instead of mysqli_*
 * - No mu-plugins, no modern hooks infrastructure
 * - Site URL stored in an options table row, not as a constant
 *
 * This function sets up the necessary compatibility shims and
 * runs the legacy installer.
 */
async function bootLegacyWordPress(
	php: PHP,
	requestHandler: PHPRequestHandler,
	options: BootWordPressOptions
): Promise<void> {
	if (options.hooks?.beforeDatabaseSetup) {
		await options.hooks.beforeDatabaseSetup(php);
	}

	if (options.mysqlProxyPort) {
		await configureWordPressForMySQLProxy(php, options.mysqlProxyPort);
	}

	await setupLegacyWordPressCompat(php);
	await ensureWpConfig(php, requestHandler.documentRoot);
	await installLegacyWordPress(php, options.siteUrl);
}

/**
 * Sets up PHP compatibility shims for legacy WordPress versions.
 *
 * WordPress 1.x/2.x used $HTTP_GET_VARS, $HTTP_POST_VARS, and
 * $HTTP_SERVER_VARS which were removed in PHP 5.4. This writes
 * a preload file that aliases them to $_GET, $_POST, $_SERVER.
 */
async function setupLegacyWordPressCompat(php: PHP): Promise<void> {
	await php.writeFile(
		'/internal/shared/preload/legacy-wp-compat.php',
		`<?php
		/**
		 * Compatibility shim for WordPress 1.x/2.x running on PHP 5.6.
		 *
		 * These long-form superglobals were removed in PHP 5.4 but
		 * WordPress 1.x relies on them throughout its codebase.
		 * Creating them as references to the modern superglobals
		 * restores the expected behavior.
		 */
		$GLOBALS['HTTP_GET_VARS'] = &$_GET;
		$GLOBALS['HTTP_POST_VARS'] = &$_POST;
		$GLOBALS['HTTP_SERVER_VARS'] = &$_SERVER;
		$GLOBALS['HTTP_COOKIE_VARS'] = &$_COOKIE;
		$GLOBALS['HTTP_ENV_VARS'] = &$_ENV;
		`
	);
}

/**
 * Runs the WordPress 1.x multi-step installer.
 *
 * WordPress 1.x has a three-step installation process:
 * - Step 1: Creates the links and link categories tables
 * - Step 2: Creates posts, categories, comments, options, and
 *           other core tables; inserts default data
 * - Step 3: Creates the users table, sets the site URL,
 *           and creates the admin user with a random password
 *
 * Unlike modern WordPress (which uses a single POST request),
 * each step must be requested separately. Steps 1 and 2 are
 * GET requests, step 3 is a POST with the site URL.
 */
async function installLegacyWordPress(
	php: PHP,
	siteUrl: string
): Promise<void> {
	// Step 1: Create links tables
	await php.request({
		url: '/wp-admin/install.php?step=1',
	});

	// Step 2: Create main blog tables (posts, categories, comments, options)
	await php.request({
		url: '/wp-admin/install.php?step=2',
	});

	// Step 3: Set site URL and create admin user
	await php.request({
		url: '/wp-admin/install.php?step=3',
		method: 'POST',
		body: {
			step: '3',
			url: siteUrl,
		},
	});
}

/**
 * Configures WordPress to connect to a MySQL proxy instead of
 * using the SQLite db.php drop-in. This rewrites the database
 * constants directly in wp-config.php so they're only defined
 * once — avoiding duplicate define() notices that would occur
 * if we set them via auto_prepend_file while wp-config.php
 * also calls define() for the same constants.
 *
 * Used for PHP 5.6, where the modern sqlite-database-integration
 * plugin can't run directly. A separate PHP 8.x instance handles
 * the query translation behind the MySQL wire protocol proxy.
 *
 * Requires that wp-config.php already exists (call ensureWpConfig
 * before this function).
 */
async function configureWordPressForMySQLProxy(
	php: PHP,
	documentRoot: string,
	proxyPort: number
): Promise<void> {
	const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');
	await defineWpConfigConstants(php, wpConfigPath, {
		DB_NAME: 'wordpress',
		DB_USER: 'root',
		DB_PASSWORD: '',
		DB_HOST: `127.0.0.1:${proxyPort}`,
		DB_CHARSET: 'utf8',
		DB_COLLATE: '',
	});
}
