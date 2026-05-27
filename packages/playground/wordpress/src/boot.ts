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
	isLegacyPHPVersion,
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
import { assertDatabasePrerequisites } from './database-prerequisites';
import {
	applyLegacyPhpIniOverrides,
	bootLegacyWordPress,
} from './legacy-wp/legacy-boot';
import { backportWpPreV62MysqlCheck } from './legacy-wp/legacy-fixes';

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

export interface WordPressInstallOptions {
	siteTitle?: string;
	adminUsername?: string;
	adminPassword?: string;
	adminEmail?: string;
}

export interface WordPressBootResult {
	adminCredentialsApplied: boolean;
}

const bootResults = new WeakMap<PHPRequestHandler, WordPressBootResult>();

export function getWordPressBootResult(
	requestHandler: PHPRequestHandler
): WordPressBootResult {
	return (
		bootResults.get(requestHandler) ?? {
			adminCredentialsApplied: false,
		}
	);
}

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
	/** Values to pass to the standard WordPress installer. */
	installOptions?: WordPressInstallOptions;
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
	if (isLegacyPHPVersion(options.phpVersion)) {
		return bootLegacyWordPress(requestHandler, options);
	}

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
	await ensureWpConfig(php, requestHandler.documentRoot);
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
		await backportWpPreV62MysqlCheck(php, requestHandler.documentRoot);
	}

	const installationMode =
		options['wordpressInstallMode'] ?? 'download-and-install';
	const hasCustomDatabasePath = !!options.dataSqlPath;
	let bootResult: WordPressBootResult = {
		adminCredentialsApplied: false,
	};

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
			const finalizeResult = await installWordPress(
				php,
				options.installOptions
			);
			bootResult = {
				adminCredentialsApplied: finalizeResult.adminCredentialsApplied,
			};
			if (!finalizeResult.databaseConnected && !hasCustomDatabasePath) {
				throwDatabaseConnectionError(php, requestHandler);
			}
		} catch (error) {
			// If installation failed, check if it's a database issue
			// to provide a more specific error message (but skip if user provided custom DB path)
			if (!hasCustomDatabasePath) {
				await assertValidDatabaseConnection(requestHandler);
			}
			// If we get here, the database is valid but installation failed for another reason
			throw error;
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
				const finalizeResult = await installWordPress(
					php,
					options.installOptions
				);
				bootResult = {
					adminCredentialsApplied:
						finalizeResult.adminCredentialsApplied,
				};
				if (
					!finalizeResult.databaseConnected &&
					!hasCustomDatabasePath
				) {
					throwDatabaseConnectionError(php, requestHandler);
				}
			} catch (error) {
				// If installation failed, check if it's a database issue
				// to provide a more specific error message (but skip if user provided custom DB path)
				if (!hasCustomDatabasePath) {
					await assertValidDatabaseConnection(requestHandler);
				}
				// If we get here, the database is valid but installation failed for another reason
				throw error;
			}
		} else {
			const finalizeResult = await finalizeWordPressBoot(
				php,
				options.installOptions,
				{ setPermalinks: false }
			);
			bootResult = {
				adminCredentialsApplied: finalizeResult.adminCredentialsApplied,
			};
			if (!finalizeResult.databaseConnected && !hasCustomDatabasePath) {
				throwDatabaseConnectionError(php, requestHandler);
			}
		}
	}

	bootResults.set(requestHandler, bootResult);
	return requestHandler;
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

	throwDatabaseConnectionError(php, requestHandler);
}

function throwDatabaseConnectionError(
	php: PHP,
	requestHandler: PHPRequestHandler
): never {
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

		applyLegacyPhpIniOverrides(php, {
			phpVersion: options.phpVersion,
			phpIniEntries: options.phpIniEntries,
		});

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
async function installWordPress(
	php: PHP,
	installOptions?: WordPressInstallOptions
) {
	const adminPassword = installOptions?.adminPassword ?? 'password';
	const requestBody = new URLSearchParams({
		language: 'en',
		prefix: 'wp_',
		weblog_title: installOptions?.siteTitle ?? 'My WordPress Website',
		user_name: installOptions?.adminUsername ?? 'admin',
		admin_password: adminPassword,
		// The installation wizard demands typing the same password twice
		admin_password2: adminPassword,
		Submit: 'Install WordPress',
		pw_weak: '1',
		admin_email: installOptions?.adminEmail ?? 'admin@localhost.com',
	});
	const installerStartedAt = performance.now();
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
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
				},
				body: new TextEncoder().encode(requestBody.toString()),
			})
	);
	logger.debug(
		`WordPress installer request completed in ${(
			performance.now() - installerStartedAt
		).toFixed(2)}ms`
	);

	const finalizationStartedAt = performance.now();
	const finalizeResult = await finalizeWordPressBoot(php, installOptions, {
		setPermalinks: true,
	});

	logger.debug(
		`WordPress boot finalization completed in ${(
			performance.now() - finalizationStartedAt
		).toFixed(2)}ms; adminCredentialsApplied=${
			finalizeResult.adminCredentialsApplied
		}`
	);

	if (!finalizeResult.installed) {
		throw new Error(
			`Failed to install WordPress – installer responded with "${response.text?.substring(
				0,
				100
			)}"`
		);
	}

	if (!finalizeResult.permalinks) {
		logger.warn('Failed to default to pretty permalinks after WP install.');
	}

	return finalizeResult;
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

interface WordPressBootFinalizationResult extends WordPressBootResult {
	installed: boolean;
	permalinks: boolean;
	databaseConnected: boolean;
}

async function finalizeWordPressBoot(
	php: PHP,
	installOptions: WordPressInstallOptions | undefined,
	options: { setPermalinks: boolean }
): Promise<WordPressBootFinalizationResult> {
	const result = await php.run({
		code: `<?php
			ob_start();
			$wp_load = getenv('DOCUMENT_ROOT') . '/wp-load.php';
			if (!file_exists($wp_load)) {
				ob_clean();
				echo json_encode(array(
					'installed' => false,
					'permalinks' => false,
					'databaseConnected' => false,
					'adminCredentialsApplied' => false,
				));
				exit;
			}

			require $wp_load;

			$installed = is_blog_installed();
			$permalinks = false;
			$database_connected = false;
			$admin_credentials_applied = false;

			if ($installed) {
				$install_options = json_decode(
					getenv('PLAYGROUND_WORDPRESS_INSTALL_OPTIONS') ?: '{}',
					true
				);
				$nice_permalinks = '/%year%/%monthnum%/%day%/%postname%/';
				if (getenv('PLAYGROUND_SET_PERMALINKS') === '1') {
					if (
						is_array($install_options) &&
						isset($install_options['siteTitle'])
					) {
						update_option('blogname', $install_options['siteTitle']);
					}
					update_option('permalink_structure', $nice_permalinks);
				}
				$permalinks = get_option('permalink_structure') === $nice_permalinks;
				$database_connected = $wpdb->check_connection(false);
				if (is_array($install_options)) {
					$admin_credentials_applied =
						playground_apply_admin_credentials($install_options);
				}
			}

			ob_clean();
			echo json_encode(array(
				'installed' => (bool) $installed,
				'permalinks' => (bool) $permalinks,
				'databaseConnected' => (bool) $database_connected,
				'adminCredentialsApplied' => (bool) $admin_credentials_applied,
			));
			ob_end_flush();

			function playground_apply_admin_credentials($install_options) {
				$has_username = isset($install_options['adminUsername']);
				$has_password = isset($install_options['adminPassword']);
				$has_email = isset($install_options['adminEmail']);
				if (!$has_username && !$has_password && !$has_email) {
					return false;
				}

				$username = $has_username
					? sanitize_user($install_options['adminUsername'], true)
					: 'admin';
				$user = get_user_by('login', $username);
				if (
					!$user &&
					$has_username &&
					getenv('PLAYGROUND_ALLOW_ADMIN_INSERT') === '1'
				) {
					$user_id = wp_insert_user(array(
						'user_login' => $username,
						'user_pass' => $has_password
							? $install_options['adminPassword']
							: wp_generate_password(),
						'user_email' => $has_email
							? $install_options['adminEmail']
							: $username . '@localhost.com',
						'role' => 'administrator',
					));
					if (!is_wp_error($user_id)) {
						$user = get_user_by('id', $user_id);
					}
				}
				if (!$user && $username !== 'admin') {
					$user = get_user_by('login', 'admin');
				}
				if (!$user && $has_email) {
					$user = get_user_by('email', $install_options['adminEmail']);
				}
				if (!$user) {
					return false;
				}

				if ($has_password) {
					wp_set_password($install_options['adminPassword'], $user->ID);
				}

				$user_data = array('ID' => $user->ID);
				if ($has_email) {
					$user_data['user_email'] = $install_options['adminEmail'];
				}
				if ($has_username && $user->user_login !== $username) {
					$user_data['user_login'] = $username;
					$user_data['user_nicename'] = $username;
					$user_data['display_name'] = $username;
				}

				if (count($user_data) > 1) {
					$update_result = wp_update_user($user_data);
					if (is_wp_error($update_result)) {
						return false;
					}
				}

				$updated_user = get_user_by('id', $user->ID);
				if (!$updated_user) {
					return false;
				}
				if ($has_username && $updated_user->user_login !== $username) {
					return false;
				}
				if (
					$has_email &&
					$updated_user->user_email !== $install_options['adminEmail']
				) {
					return false;
				}
				if (
					$has_password &&
					!wp_check_password(
						$install_options['adminPassword'],
						$updated_user->user_pass,
						$updated_user->ID
					)
				) {
					return false;
				}

				return true;
			}
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
			PLAYGROUND_SET_PERMALINKS: options.setPermalinks ? '1' : '0',
			PLAYGROUND_ALLOW_ADMIN_INSERT: options.setPermalinks ? '1' : '0',
			PLAYGROUND_WORDPRESS_INSTALL_OPTIONS: JSON.stringify(
				installOptions ?? {}
			),
		},
	});

	try {
		return JSON.parse(result.text);
	} catch (error) {
		throw new Error(
			`Failed to finalize WordPress boot – received "${result.text?.substring(
				0,
				100
			)}"`,
			{ cause: error }
		);
	}
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
