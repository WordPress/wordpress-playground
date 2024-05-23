import {
	BasePHP,
	FileTree,
	PHPProcessManager,
	PHPRequestHandler,
	SpawnHandler,
	proxyFileSystem,
	rotatePHPRuntime,
	setPhpIniEntries,
	withPHPIniValues,
	writeFiles,
} from '@php-wasm/universal';
import {
	enablePlatformMuPlugins,
	preloadPhpInfoRoute,
	preloadRequiredMuPlugin,
	preloadSqliteIntegration,
	unzipWordPress,
	wordPressRewriteRules,
} from '.';
import { joinPaths } from '@php-wasm/util';

export type PhpIniOptions = Record<string, string>;
export type Hook = (php: BasePHP) => void | Promise<void>;
export interface Hooks {
	beforeWordPress?: Hook;
	beforeDatabase?: Hook;
}

export type DatabaseType = 'sqlite' | 'mysql' | 'custom';

export interface BootOptions<PHP extends BasePHP> {
	createPhpRuntime: () => Promise<number>;
	createPhpInstance: () => PHP;
	/** Default: 'sqlite' */
	databaseType?: DatabaseType;
	/**
	 * Mounting and Copying is handled via hooks for starters.
	 *
	 * In the future we could standardize the
	 * browser-specific and node-specific mounts
	 * in the future.
	 */
	hooks?: Hooks;
	/**
	 * PHP SAPI name to be returned by get_sapi_name(). Overriding
	 * it is useful for running programs that check for this value,
	 * e.g. WP-CLI
	 */
	sapiName?: string;
	siteUrl: string;
	/** SQL file to load instead of installing WordPress. */
	dataSqlPath?: string;
	/** Zip with the WordPress installation to extract in /wordpress. */
	wordPressZip?: File | Promise<File> | undefined;
	/** Preloaded SQLite integration plugin. */
	sqliteIntegrationPluginZip?: File | Promise<File>;
	spawnHandler?: (processManager: PHPProcessManager<BasePHP>) => SpawnHandler;
	phpIniEntries?: PhpIniOptions;
	constants?: Record<string, string | number | boolean | null>;
	createFiles?: FileTree;
}

export async function bootWordPress<PHP extends BasePHP>(
	options: BootOptions<PHP>
) {
	async function createPhp(
		requestHandler: PHPRequestHandler<BasePHP>,
		isPrimary: boolean
	) {
		const php = options.createPhpInstance();
		php.initializeRuntime(await options.createPhpRuntime());
		if (options.sapiName) {
			php.setSapiName(options.sapiName);
		}
		if (requestHandler) {
			php.requestHandler = requestHandler;
		}
		if (options.phpIniEntries) {
			setPhpIniEntries(php, options.phpIniEntries);
		}
		if (isPrimary) {
			await enablePlatformMuPlugins(php);
			await preloadRequiredMuPlugin(php);
			await writeFiles(php, '/', options.createFiles || {});
			await preloadPhpInfoRoute(
				php,
				joinPaths(new URL(options.siteUrl).pathname, 'phpinfo.php')
			);
		} else {
			proxyFileSystem(await requestHandler.getPrimaryPhp(), php, [
				'/tmp',
				requestHandler.documentRoot,
				'/internal/shared',
			]);
		}

		if (options.spawnHandler) {
			await php.setSpawnHandler(
				options.spawnHandler(requestHandler.processManager)
			);
		}

		// php.setSpawnHandler(spawnHandlerFactory(processManager));
		// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
		// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
		rotatePHPRuntime({
			php,
			cwd: requestHandler.documentRoot,
			recreateRuntime: options.createPhpRuntime,
			maxRequests: 400,
		});

		return php;
	}

	const requestHandler: PHPRequestHandler<PHP> = new PHPRequestHandler<PHP>({
		phpFactory: async ({ isPrimary }) =>
			createPhp(requestHandler, isPrimary),
		documentRoot: '/wordpress',
		absoluteUrl: options.siteUrl,
		rewriteRules: wordPressRewriteRules,
	});

	const php = await requestHandler.getPrimaryPhp();

	if (options.hooks?.beforeWordPress) {
		await options.hooks.beforeWordPress(php);
	}

	if (options.wordPressZip) {
		await unzipWordPress(php, await options.wordPressZip);
	}

	if (options.constants) {
		for (const key in options.constants) {
			php.defineConstant(key, options.constants[key] as string);
		}
	}

	php.defineConstant('WP_HOME', options.siteUrl);
	php.defineConstant('WP_SITEURL', options.siteUrl);

	// @TODO Assert WordPress core is set up

	if (options.hooks?.beforeDatabase) {
		await options.hooks.beforeDatabase(php);
	}

	// Run "before database" hooks to mount/copy more files in
	if (options.sqliteIntegrationPluginZip) {
		await preloadSqliteIntegration(
			php,
			await options.sqliteIntegrationPluginZip
		);
	}

	if (!(await isWordPressInstalled(php))) {
		await installWordPress(php);
	}

	if (!(await isWordPressInstalled(php))) {
		// @TODO: More error information
		throw new Error('WordPress installation has failed.');
	}

	return requestHandler;
}

async function isWordPressInstalled(php: BasePHP) {
	return (
		(
			await php.run({
				code: `<?php 
	require '${php.documentRoot}/wp-load.php';
	echo is_blog_installed() ? '1' : '0';
	`,
			})
		).text === '1'
	);
}

async function installWordPress(php: BasePHP) {
	// Disables networking for the installation wizard
	// to avoid loopback requests and also speed it up.
	await withPHPIniValues(
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
}
