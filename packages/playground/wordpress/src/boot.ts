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
import { ensureWpConfig } from './wp-config';
import {
	generateDbPhpContent,
	LEGACY_WP_ERROR_REPORTING_PHP_EXPR,
	LEGACY_WP_ERROR_REPORTING_VALUE,
	patchWordPressSourceFiles,
	runPostInstallLegacyFixups,
} from './legacy-wp-fixes';

/**
 * Network I/O functions that must be disabled on legacy PHP builds
 * (< 7) to avoid "null function or function signature mismatch"
 * WASM crashes when WordPress calls fsockopen or cURL during cron,
 * update checks, dashboard RSS widgets, etc.
 */
const LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS = [
	'fsockopen',
	'pfsockopen',
	'curl_init',
	'curl_exec',
	'curl_multi_exec',
] as const;

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
	/**
	 * PHP version string (e.g. '8.3', '5.2'). Used to gate
	 * legacy-PHP-specific behavior in the boot chain.
	 */
	phpVersion?: string;
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
	/** PHP version string (e.g. '8.3', '5.2'). */
	phpVersion?: string;
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

	php.defineConstant('WP_HOME', options.siteUrl);
	php.defineConstant('WP_SITEURL', options.siteUrl);

	/*
	 * Ensure required constants are defined if "wp-config.php" doesn't define
	 * them. This is needed because some WordPress backups and exports may not
	 * include definitions for some of the necessary constants.
	 */
	const phpMajor = Number.isFinite(parseInt(options.phpVersion ?? '', 10))
		? parseInt(options.phpVersion!, 10)
		: 8;
	if (phpMajor >= 7) {
		await ensureWpConfig(php, requestHandler.documentRoot);
	} else {
		// For legacy PHP, skip ensureWpConfig since the pre-built
		// WordPress already has a valid wp-config-sample.php and
		// php.run() with the large transformer code hangs.
		// Just copy wp-config-sample.php to wp-config.php if needed.
		const wpConfigPath = joinPaths(
			requestHandler.documentRoot,
			'wp-config.php'
		);
		if (
			!php.fileExists(wpConfigPath) &&
			php.fileExists(
				joinPaths(requestHandler.documentRoot, 'wp-config-sample.php')
			)
		) {
			await php.writeFile(
				wpConfigPath,
				await php.readFileAsBuffer(
					joinPaths(
						requestHandler.documentRoot,
						'wp-config-sample.php'
					)
				)
			);
		}
	}
	if (phpMajor < 7) {
		await patchWordPressSourceFiles(php, requestHandler.documentRoot);
	}

	// Run "before database" hooks to mount/copy more files in
	if (options.hooks?.beforeDatabaseSetup) {
		await options.hooks.beforeDatabaseSetup(php);
	}

	// @TODO Assert WordPress core files are in place

	let usesSqlite = false;
	if (options.sqliteIntegrationPluginZip) {
		usesSqlite = true;
		await preloadSqliteIntegration(
			php,
			await options.sqliteIntegrationPluginZip,
			{ phpVersion: options.phpVersion }
		);

		// Write wp-content/db.php with MySQL function stubs for
		// legacy WordPress. WP 4.x checks extension_loaded('mysql')
		// and only skips that check if wp-content/db.php exists.
		// patchWpSettingsPhp() patches that check away, but only
		// runs for legacy PHP. Modern WP doesn't have this check.
		if (phpMajor < 7) {
			const wpContentDir = joinPaths(
				requestHandler.documentRoot,
				'wp-content'
			);
			const dbPhpPath = joinPaths(wpContentDir, 'db.php');
			if (php.isDir(wpContentDir) && !php.fileExists(dbPhpPath)) {
				await php.writeFile(dbPhpPath, generateDbPhpContent());
			}
		}
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
		await installWordPressSafe(
			php,
			phpMajor,
			hasCustomDatabasePath,
			requestHandler,
			options.phpVersion
		);
		if (!hasCustomDatabasePath) {
			await assertValidDatabaseConnectionSafe(
				requestHandler,
				options.phpVersion
			);
		}
	} else if ('install-from-existing-files-if-needed' === installationMode) {
		// Check database prerequisites before attempting installation
		await assertDatabasePrerequisites(requestHandler, {
			usesSqlite,
			hasCustomDatabasePath,
		});
		// For legacy PHP (< 7), skip isWordPressInstalled check because
		// it crashes the WASM runtime on old WordPress (< 3.0) where the
		// SQLite driver initialization chain isn't fully compatible.
		const isInstalled =
			phpMajor >= 7 ? await isWordPressInstalled(php) : false;
		if (!isInstalled) {
			await installWordPressSafe(
				php,
				phpMajor,
				hasCustomDatabasePath,
				requestHandler,
				options.phpVersion
			);
		}
		// Validate the database connection after installation
		if (!hasCustomDatabasePath) {
			await assertValidDatabaseConnectionSafe(
				requestHandler,
				options.phpVersion
			);
		}
	}

	return requestHandler;
}

/**
 * Wrapper around installWordPress that handles errors gracefully
 * for legacy PHP versions where installation errors may be non-fatal.
 */
async function installWordPressSafe(
	php: PHP,
	phpMajor: number,
	hasCustomDatabasePath: boolean,
	requestHandler: PHPRequestHandler,
	phpVersion?: string
): Promise<void> {
	try {
		await installWordPress(php, phpMajor);
	} catch (error) {
		if (!hasCustomDatabasePath) {
			await assertValidDatabaseConnectionSafe(requestHandler, phpVersion);
		}
		if (phpMajor >= 7) {
			throw error;
		}
		logger.warn('Legacy PHP WordPress installation error:', error);
	}
	// Run legacy fixups whether the installer succeeded or threw. On
	// WP 1.x the installer routinely fails halfway through and we rely
	// on the fixups (stage 2 in particular) to finish building the
	// schema. On newer legacy WP where the installer succeeded, the
	// fixups short-circuit cheaply: stage 1 exits before loading WP if
	// wp_users doesn't exist yet, and stage 2 is gated to WP < 3.5, so
	// the only work done on the happy path is a pair of UPDATE queries
	// against wp_options (siteurl/home) plus an admin-password reset.
	if (phpMajor < 7) {
		await runPostInstallLegacyFixups(php, requestHandler.absoluteUrl);
	}
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

	// If SQLite integration is preloaded via core, we're good
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

	// Check if wp-config.php has real MySQL credentials
	if (hasValidMySQLCredentials(php)) {
		return;
	}

	// No SQLite integration and no MySQL credentials found
	// Throw early to avoid attempting installation with no database
	throw new Error('Error connecting to the MySQL database.');
}

/**
 * For legacy PHP (< 7), skip the database connection check entirely.
 *
 * Calling isDatabaseConnectionValid() loads wp-load.php. On some old
 * WordPress versions (2.5–2.7) this triggers a WASM "null function or
 * function signature mismatch" crash that corrupts the PHP instance and
 * prevents the front page from loading. The check is non-fatal for
 * legacy PHP anyway — runPostInstallLegacyFixups() handles any setup
 * that's needed. Skipping gives the same observable result (no error
 * thrown) without the risk of state corruption.
 */
async function assertValidDatabaseConnectionSafe(
	requestHandler: PHPRequestHandler,
	phpVersion?: string
) {
	const phpMajor = parseInt(phpVersion ?? '8', 10);
	if (phpMajor < 7) {
		return;
	}
	await assertValidDatabaseConnection(requestHandler);
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

		// Disable network I/O for legacy PHP (< 7) to prevent WASM
		// crashes. Old WordPress (2.5–3.6) calls fsockopen/cURL during
		// cron, update checks, and dashboard RSS widgets. The
		// underlying socket/cURL operations trigger "null function or
		// function signature mismatch" WASM errors; disabling them
		// makes the calls fail safely (return false) instead of
		// crashing.
		//
		// setPhpIniEntries overwrites keys, so we merge with whatever
		// the caller already passed in `options.phpIniEntries` —
		// otherwise a networking-disabled list from the web worker
		// would be silently replaced by this legacy-only list.
		if (parseInt(options.phpVersion ?? '8', 10) < 7) {
			const legacyDisabled = [...LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS];
			const callerDisabled = (
				options.phpIniEntries?.['disable_functions'] ?? ''
			)
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s);
			const mergedDisabled = Array.from(
				new Set([...callerDisabled, ...legacyDisabled])
			).join(',');
			setPhpIniEntries(php, {
				disable_functions: mergedDisabled,
				allow_url_fopen: '0',
			});
		}

		// Use the new AST-based SQLite driver for all supported PHP
		// versions. The PHP 5.2 build of the driver is the
		// `v2.2.22-php52` variant bundled alongside trunk; it has
		// closures hoisted to named functions and a few polyfills so
		// it runs unmodified on PHP 5.2. See the
		// `sqlite-database-integration-v2.2.22-php52.zip` asset.
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
			await setupPlatformLevelMuPlugins(php, {
				phpVersion: options.phpVersion,
			});
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
async function installWordPress(php: PHP, phpMajor = 8) {
	// WP 1.0–3.0 on legacy PHP: skip the install.php HTTP request
	// entirely. These old installers trigger various unreachable WASM
	// traps (mail(), mysql_get_server_info(), etc.) that the PHP 5.2
	// binary can't handle. The runPostInstallLegacyFixups() PDO
	// fallback creates all tables, users, options, and content
	// without running any crashable PHP.
	if (phpMajor < 7) {
		const versionPhp = joinPaths(
			php.documentRoot,
			'wp-includes/version.php'
		);
		if (php.fileExists(versionPhp)) {
			const content = php.readFileAsText(versionPhp);
			const match = content.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
			if (match) {
				const wpVersion = match[1];
				// WP 1.0–3.0 installers trigger unreachable WASM
				// traps from mail(), network calls,
				// mysql_get_server_info(), etc. WP 3.1+ works
				// with targeted function patches.
				//
				// WP 1.0-1.2: the post-install PDO fallback
				//   creates the very simple schema entirely.
				// WP 1.5-3.0: needs dbDelta() for proper table
				//   schemas but skip the rest of the installer.
				if (parseFloat(wpVersion) < 2.1) {
					return;
				}
				if (parseFloat(wpVersion) <= 3.0) {
					await runDbDeltaOnly(php);
					return;
				}
			}
		}
	}

	const iniOverrides: Record<string, string> = {
		// Disable network I/O functions during installation.
		// For legacy PHP (< 7), this must include all the functions
		// already disabled in bootRequestHandler — setPhpIniEntries
		// replaces the entire value, so listing only 'fsockopen'
		// would re-enable curl_init/curl_exec and cause WASM crashes
		// when the installer makes outbound HTTP requests.
		disable_functions:
			phpMajor < 7
				? [...LEGACY_PHP_DISABLED_NETWORK_FUNCTIONS, 'mail'].join(',')
				: 'fsockopen',
		allow_url_fopen: '0',
	};
	if (phpMajor < 7) {
		// Suppress E_DEPRECATED (8192) and E_STRICT (2048) at
		// the ini level. Old WordPress class declarations trigger
		// E_STRICT warnings during compilation (e.g. Walker_Page)
		// which PHP may report using the ini error_reporting value
		// rather than the runtime error_reporting() call.
		iniOverrides['error_reporting'] = String(
			LEGACY_WP_ERROR_REPORTING_VALUE
		);
	}
	const response = await withPHPIniValues(
		php,
		iniOverrides,
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

	if (phpMajor < 7) {
		// Legacy PHP (< 7): skip isWordPressInstalled() entirely — it
		// can trigger a WASM trap (not a PHP exception) on old WordPress
		// (< 3.0), which corrupts the runtime beyond recovery. Use the
		// installer response text as a heuristic instead.
		const installSucceeded =
			response.text?.includes('Success') ||
			response.text?.includes('successful') ||
			response.text?.includes('Finished') ||
			response.text?.includes('Already Installed') ||
			response.text?.includes('already have WordPress installed') ||
			false;
		if (!installSucceeded) {
			throw new Error(
				`Failed to install WordPress – installer responded with "${response.text?.substring(
					0,
					100
				)}"`
			);
		}
	} else if (!(await isWordPressInstalled(php))) {
		throw new Error(
			`Failed to install WordPress – installer responded with "${response.text?.substring(
				0,
				100
			)}"`
		);
	}

	if (phpMajor < 7) {
		// Legacy PHP: set permalink_structure via PDO instead of
		// update_option(). On WP < 4.8.3, wpdb::prepare() passes
		// the value through vsprintf() without escaping '%'
		// characters first (the placeholder_escape mechanism was
		// added in 4.8.3). The '%y', '%m', '%d', '%p' sequences
		// in the permalink pattern are interpreted as sprintf
		// format specifiers, mangling the stored value.
		// Using PDO bypasses wpdb entirely.
		try {
			const result = await php.run({
				code: `<?php
					$db_dir = getenv('DOCUMENT_ROOT') . '/wp-content/database/';
					$db_path = $db_dir . '.ht.sqlite';
					if (!file_exists($db_path)) { echo '0'; exit; }
					$pdo = new PDO('sqlite:' . $db_path);
					$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
					$nice_permalinks = '/%year%/%monthnum%/%day%/%postname%/';
					$stmt = $pdo->prepare(
						"UPDATE wp_options SET option_value = :val WHERE option_name = 'permalink_structure'"
					);
					$stmt->execute(array(':val' => $nice_permalinks));
					if ($stmt->rowCount() === 0) {
						$stmt = $pdo->prepare(
							"INSERT INTO wp_options (option_name, option_value, autoload) VALUES ('permalink_structure', :val, 'yes')"
						);
						$stmt->execute(array(':val' => $nice_permalinks));
					}
					$check = $pdo->query(
						"SELECT option_value FROM wp_options WHERE option_name = 'permalink_structure'"
					)->fetchColumn();
					echo $check === $nice_permalinks ? '1' : '0';
				`,
				env: { DOCUMENT_ROOT: php.documentRoot },
			});
			if (result.text !== '1') {
				logger.warn(
					'Failed to default to pretty permalinks after WP install.'
				);
			}
		} catch {
			logger.warn(
				'Failed to set pretty permalinks after WP install (non-fatal).'
			);
		}
	} else {
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
			logger.warn(
				'Failed to default to pretty permalinks after WP install.'
			);
		}
	}
}

/**
 * Runs dbDelta() and populate_options/populate_roles without the
 * full wp_install() function. Used for WP 2.3–3.0 where the
 * installer crashes but we still need the table schemas.
 */
async function runDbDeltaOnly(php: PHP): Promise<void> {
	try {
		await php.run({
			code: `<?php
				define('WP_INSTALLING', true);
				error_reporting(${LEGACY_WP_ERROR_REPORTING_PHP_EXPR});
				ini_set('display_errors', '0');
				ob_start();
				require getenv('DOCUMENT_ROOT') . '/wp-load.php';
				ob_clean();
				// Load upgrade functions for dbDelta
				if (file_exists(ABSPATH . 'wp-admin/includes/upgrade.php')) {
					require_once ABSPATH . 'wp-admin/includes/upgrade.php';
				} elseif (file_exists(ABSPATH . 'wp-admin/upgrade-functions.php')) {
					require_once ABSPATH . 'wp-admin/upgrade-functions.php';
				}
				// Create tables via dbDelta — the critical step that
				// creates the proper schema for the WP version.
				if (function_exists('make_db_current_silent')) {
					make_db_current_silent();
				}
				// populate_options/populate_roles on WP 2.3+ only.
				// WP 2.1-2.2 crash in these functions (WASM traps
				// from mail/network calls that bypass PHP try/catch).
				// The PDO fallback seeds essential options/roles.
				global $wp_version;
				// populate_options sets db_version and other essential
				// options. populate_roles creates the roles/capabilities.
				// On PHP 5.2 WP 2.1-2.2 these crash with WASM traps.
				// Run them for any WP version that defines them.
				if (function_exists('populate_options')) populate_options();
				if (function_exists('populate_roles')) populate_roles();
				echo 'OK';
			`,
			env: { DOCUMENT_ROOT: php.documentRoot },
		});
	} catch (error) {
		logger.warn('runDbDeltaOnly failed (non-fatal):', error);
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

function hasValidMySQLCredentials(php: PHP) {
	const wpConfigPath = joinPaths(php.documentRoot, 'wp-config.php');
	if (!php.isFile(wpConfigPath)) return false;

	const wpConfig = php.readFileAsText(wpConfigPath);

	const dbName = wpConfig.match(
		/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]*)['"]/
	);
	const dbUser = wpConfig.match(
		/define\s*\(\s*['"]DB_USER['"]\s*,\s*['"]([^'"]*)['"]/
	);

	if (!dbName || !dbUser) return false;

	return dbName[1] !== 'database_name_here' && dbUser[1] !== 'username_here';
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
