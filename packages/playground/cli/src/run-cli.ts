import { errorLogPath, logger, LogSeverity } from '@php-wasm/logger';
import { ProcessIdAllocator } from './process-id-allocator';
import {
	createObjectPoolProxy,
	type Pooled,
	type PHPRequest,
	type PathAlias,
	type RemoteAPI,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHPResponse,
	HttpCookieStore,
	exposeAPI,
	exposeSyncAPI,
	printDebugDetails,
} from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintV1Declaration,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import {
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import fs, { existsSync, mkdirSync, readdirSync, rmdirSync } from 'fs';
import type { Server } from 'http';
import { MessageChannel as NodeMessageChannel, Worker } from 'worker_threads';
// @ts-ignore
import {
	expandAutoMounts,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
} from './mounts';
import {
	parseDefineStringArguments,
	parseDefineBoolArguments,
	parseDefineNumberArguments,
} from './defines';
import { startServer } from './start-server';
import type { PlaygroundCliBlueprintV1Worker } from './blueprints-v1/worker-thread-v1';
import type { PlaygroundCliBlueprintV2Worker } from './blueprints-v2/worker-thread-v2';
/* eslint-disable no-console */
import {
	SupportedPHPVersions,
	FileLockManagerInMemory,
} from '@php-wasm/universal';
import { cpus } from 'os';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import yargs, { type Argv, type Options as YargsOptions } from 'yargs';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import { resolveBlueprint } from './resolve-blueprint';
import { BlueprintsV2Handler } from './blueprints-v2/blueprints-v2-handler';
import { BlueprintsV1Handler } from './blueprints-v1/blueprints-v1-handler';
import { startBridge } from '@php-wasm/xdebug-bridge';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import {
	cleanupStalePlaygroundTempDirs,
	createPlaygroundCliTempDir,
} from './temp-dir';
import { type WordPressInstallMode } from '@wp-playground/wordpress';
import {
	type Mount,
	addXdebugIDEConfig,
	clearXdebugIDEConfig,
	createTempDirSymlink,
	removeTempDirSymlink,
} from '@php-wasm/cli-util';
import { createHash } from 'crypto';
import { CLIOutput } from './cli-output';
import {
	getPhpMyAdminInstallSteps,
	PHPMYADMIN_ENTRY_PATH,
	PHPMYADMIN_INSTALL_PATH,
} from '@wp-playground/tools';
import { jspi } from 'wasm-feature-detect';

// Inlined worker URLs for static analysis by downstream bundlers
// These are replaced at build time by the Vite plugin in vite.config.ts
declare const __WORKER_V1_URL__: string;
declare const __WORKER_V2_URL__: string;

export const LogVerbosity = {
	Quiet: { name: 'quiet', severity: LogSeverity.Fatal },
	Normal: { name: 'normal', severity: LogSeverity.Info },
	Debug: { name: 'debug', severity: LogSeverity.Debug },
} as const;

type LogVerbosity = (typeof LogVerbosity)[keyof typeof LogVerbosity]['name'];

export type WorkerType = 'v1' | 'v2';

// TODO: Consider creating more workers on demand if other workers blocked to avoid deadlock.
const MINIMUM_WORKER_COUNT = 10;

/**
 * Parse the CLI args and run the appropriate command.
 *
 * @param argsToParse string[] The CLI args to parse.
 */
export async function parseOptionsAndRunCLI(argsToParse: string[]) {
	try {
		/**
		 * @TODO This looks similar to Query API args https://wordpress.github.io/wordpress-playground/developers/apis/query-api/
		 *       Perhaps the two could be handled by the same code?
		 */
		const sharedOptions: Record<string, YargsOptions> = {
			'site-url': {
				describe:
					'Site URL to use for WordPress. Defaults to http://127.0.0.1:{port}',
				type: 'string',
			},
			php: {
				describe: 'PHP version to use.',
				type: 'string',
				default: RecommendedPHPVersion,
				choices: SupportedPHPVersions,
			},
			wp: {
				describe: 'WordPress version to use.',
				type: 'string',
				default: 'latest',
			},
			define: {
				describe:
					'Define PHP string constants (can be used multiple times). ' +
					'Format: NAME value. ' +
					'These constants are set via php.defineConstant() and only exist for the current request. ' +
					'Examples: --define API_KEY secret --define CON=ST "va=lu=e"',
				type: 'string',
				nargs: 2,
				array: true,
				coerce: parseDefineStringArguments,
			},
			'define-bool': {
				describe:
					'Define PHP boolean constants (can be used multiple times). ' +
					'Format: NAME value. Value must be "true", "false", "1", or "0". ' +
					'Examples: --define-bool WP_DEBUG true --define-bool MY_FEATURE false',
				type: 'string',
				nargs: 2,
				array: true,
				coerce: parseDefineBoolArguments,
			},
			'define-number': {
				describe:
					'Define PHP number constants (can be used multiple times). ' +
					'Format: NAME value. ' +
					'Examples: --define-number LIMIT 100 --define-number RATE 45.67',
				type: 'string',
				nargs: 2,
				array: true,
				coerce: parseDefineNumberArguments,
			},
			// @TODO: Support read-only mounts, e.g. via WORKERFS, a custom
			// ReadOnlyNODEFS, or by copying the files into MEMFS
			mount: {
				describe:
					'Mount a directory to the PHP runtime (can be used multiple times). Format: /host/path:/vfs/path',
				type: 'array',
				string: true,
				coerce: parseMountWithDelimiterArguments,
			},
			'mount-before-install': {
				describe:
					'Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: /host/path:/vfs/path',
				type: 'array',
				string: true,
				coerce: parseMountWithDelimiterArguments,
			},
			'mount-dir': {
				describe:
					'Mount a directory to the PHP runtime (can be used multiple times). Format: "/host/path" "/vfs/path"',
				type: 'array',
				nargs: 2,
				array: true,
				coerce: parseMountDirArguments,
			},
			'mount-dir-before-install': {
				describe:
					'Mount a directory before WordPress installation (can be used multiple times). Format: "/host/path" "/vfs/path"',
				type: 'string',
				nargs: 2,
				array: true,
				coerce: parseMountDirArguments,
			},
			login: {
				describe: 'Should log the user in',
				type: 'boolean',
				default: false,
			},
			blueprint: {
				describe: 'Blueprint to execute.',
				type: 'string',
			},
			'blueprint-may-read-adjacent-files': {
				describe:
					'Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.',
				type: 'boolean',
				default: false,
			},
			'wordpress-install-mode': {
				describe:
					'Control how Playground prepares WordPress before booting.',
				type: 'string',
				default: 'download-and-install',
				choices: [
					'download-and-install',
					'install-from-existing-files',
					'install-from-existing-files-if-needed',
					'do-not-attempt-installing',
				] as const,
			},
			'skip-wordpress-install': {
				describe: '[Deprecated] Use --wordpress-install-mode instead.',
				type: 'boolean',
				hidden: true,
			},
			'skip-sqlite-setup': {
				describe:
					'Skip the SQLite integration plugin setup to allow the WordPress site to use MySQL.',
				type: 'boolean',
				default: false,
			},
			// Hidden - Deprecated in favor of verbosity
			quiet: {
				describe: 'Do not output logs and progress messages.',
				type: 'boolean',
				default: false,
				hidden: true,
			},
			verbosity: {
				describe: 'Output logs and progress messages.',
				type: 'string',
				choices: Object.values(LogVerbosity).map(
					(verbosity) => verbosity.name
				),
				default: 'normal',
			},
			debug: {
				describe:
					'Print PHP error log content if an error occurs during Playground boot.',
				type: 'boolean',
				default: false,
				// Hide this deprecated option. Use verbosity=debug instead.
				hidden: true,
			},
			'auto-mount': {
				describe: `Automatically mount the specified directory. If no path is provided, mount the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.`,
				type: 'string',
			},
			'follow-symlinks': {
				describe:
					'Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. \nWarning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.',
				type: 'boolean',
				default: false,
			},
			'experimental-trace': {
				describe:
					'Print detailed messages about system behavior to the console. Useful for troubleshooting.',
				type: 'boolean',
				default: false,
				// Hide this option because we want to replace with a more general log-level flag.
				hidden: true,
			},
			'internal-cookie-store': {
				describe:
					'Enable internal cookie handling. When enabled, Playground will manage cookies internally using ' +
					'an HttpCookieStore that persists cookies across requests. When disabled, cookies are handled ' +
					'externally (e.g., by a browser in Node.js environments).',
				type: 'boolean',
				default: false,
			},
			intl: {
				describe: 'Enable Intl.',
				type: 'boolean',
				default: true,
			},
			redis: {
				describe: 'Enable Redis (requires JSPI support).',
				type: 'boolean',
				// No default - will be determined at runtime based on JSPI availability
			},
			memcached: {
				describe: 'Enable Memcached.',
				type: 'boolean',
				// No default - will be determined at runtime based on JSPI availability
			},
			xdebug: {
				describe: 'Enable Xdebug.',
				type: 'boolean',
				default: false,
			},
			'experimental-unsafe-ide-integration': {
				describe:
					'Enable experimental IDE development tools. This option edits IDE config files ' +
					'to set Xdebug path mappings and web server details. CAUTION: If there are bugs, ' +
					'this feature may break your IDE config files. Please consider backing up your IDE configs ' +
					'before using this feature.',
				type: 'string',
				// The empty value means the option is enabled for all
				// supported IDEs and, if needed, will create the relevant
				// config file for each.
				choices: ['', 'vscode', 'phpstorm'],
				coerce: (value?: string) =>
					value === '' ? ['vscode', 'phpstorm'] : [value],
			},
			'experimental-blueprints-v2-runner': {
				describe: 'Use the experimental Blueprint V2 runner.',
				type: 'boolean',
				default: false,
				// Remove the "hidden" flag once Blueprint V2 is fully supported
				hidden: true,
			},
			mode: {
				describe:
					'Blueprints v2 runner mode to use. This option is required when using the --experimental-blueprints-v2-runner flag with a blueprint.',
				type: 'string',
				choices: ['create-new-site', 'apply-to-existing-site'],
				// Remove the "hidden" flag once Blueprint V2 is fully supported
				hidden: true,
			},
			phpmyadmin: {
				describe:
					'Install phpMyAdmin for database management. The phpMyAdmin URL will be printed after boot. Optionally specify a custom URL path (default: /phpmyadmin).',
				type: 'string',
				coerce: (value?: string) =>
					'' === value ? '/phpmyadmin' : value,
			},
		};

		const serverOnlyOptions: Record<string, YargsOptions> = {
			port: {
				describe: 'Port to listen on when serving.',
				type: 'number',
				default: 9400,
			},
			'experimental-multi-worker': {
				deprecated:
					'This option is not needed. Multiple workers are always used.',
				describe:
					'Enable experimental multi-worker support which requires ' +
					'a /wordpress directory backed by a real filesystem. ' +
					'Pass a positive number to specify the number of workers to use. ' +
					'Otherwise, default to the number of CPUs minus 1.',
				type: 'number',
			},
			'experimental-devtools': {
				describe: 'Enable experimental browser development tools.',
				type: 'boolean',
			},
		};

		/**
		 * Options for the high-level `start` command.
		 * This command provides a simplified, opinionated interface for common use cases,
		 * similar to wp-now. It auto-detects project type and uses sensible defaults.
		 */
		const startCommandOptions: Record<string, YargsOptions> = {
			path: {
				describe:
					'Path to the project directory. Playground will auto-detect if this is a plugin, theme, wp-content, or WordPress directory.',
				type: 'string',
				default: process.cwd(),
			},
			php: {
				describe: 'PHP version to use.',
				type: 'string',
				default: RecommendedPHPVersion,
				choices: SupportedPHPVersions,
			},
			wp: {
				describe: 'WordPress version to use.',
				type: 'string',
				default: 'latest',
			},
			port: {
				describe: 'Port to listen on.',
				type: 'number',
				default: 9400,
			},
			blueprint: {
				describe:
					'Path to a Blueprint JSON file to execute on startup.',
				type: 'string',
			},
			login: {
				describe: 'Auto-login as the admin user.',
				type: 'boolean',
				default: true,
			},
			xdebug: {
				describe: 'Enable Xdebug for debugging.',
				type: 'boolean',
				default: false,
			},
			'experimental-unsafe-ide-integration':
				sharedOptions['experimental-unsafe-ide-integration'],
			'skip-browser': {
				describe:
					'Do not open the site in your default browser on startup.',
				type: 'boolean',
				default: false,
			},
			quiet: {
				describe: 'Suppress non-essential output.',
				type: 'boolean',
				default: false,
			},
			// Advanced options for power users who need more control
			'site-url': {
				describe:
					'Override the site URL. By default, derived from the port (http://127.0.0.1:<port>).',
				type: 'string',
			},
			mount: {
				describe:
					'Mount a directory to the PHP runtime (can be used multiple times). Format: /host/path:/vfs/path. Use this for additional mounts beyond auto-detection.',
				type: 'array',
				string: true,
				coerce: parseMountWithDelimiterArguments,
			},
			reset: {
				describe:
					'Deletes the stored site directory and starts a new site from scratch.',
				type: 'boolean',
				default: false,
			},
			'no-auto-mount': {
				describe:
					'Disable automatic project type detection. Use --mount to manually specify mounts instead.',
				type: 'boolean',
				default: false,
			},
			// Define constants
			define: sharedOptions['define'],
			'define-bool': sharedOptions['define-bool'],
			'define-number': sharedOptions['define-number'],
			// Tools
			phpmyadmin: sharedOptions['phpmyadmin'],
		};

		const buildSnapshotOnlyOptions: Record<string, YargsOptions> = {
			outfile: {
				describe: 'When building, write to this output file.',
				type: 'string',
				default: 'wordpress.zip',
			},
		};

		const yargsObject = yargs(argsToParse)
			.usage('Usage: wp-playground <command> [options]')
			.command(
				'start',
				'Start a local WordPress server with automatic project detection (recommended)',
				(yargsInstance: Argv) =>
					yargsInstance
						.usage(
							'Usage: wp-playground start [options]\n\n' +
								'The easiest way to run WordPress locally. Automatically detects\n' +
								'if your directory contains a plugin, theme, wp-content, or\n' +
								'WordPress installation and configures everything for you.\n\n' +
								'Examples:\n' +
								'  wp-playground start                    # Start in current directory\n' +
								'  wp-playground start --path=./my-plugin # Start with a specific path\n' +
								'  wp-playground start --wp=6.7 --php=8.3 # Use specific versions\n' +
								'  wp-playground start --skip-browser     # Skip opening browser\n' +
								'  wp-playground start --no-auto-mount    # Disable auto-detection'
						)
						.options(startCommandOptions)
			)
			.command(
				'server',
				'Start a local WordPress server (advanced, low-level)',
				(yargsInstance: Argv) =>
					yargsInstance.options({
						...sharedOptions,
						...serverOnlyOptions,
					})
			)
			.command(
				'run-blueprint',
				'Execute a Blueprint without starting a server',
				(yargsInstance: Argv) =>
					yargsInstance.options({ ...sharedOptions })
			)
			.command(
				'build-snapshot',
				'Build a ZIP snapshot of a WordPress site based on a Blueprint',
				(yargsInstance: Argv) =>
					yargsInstance.options({
						...sharedOptions,
						...buildSnapshotOnlyOptions,
					})
			)
			.demandCommand(1, 'Please specify a command')
			.strictCommands()
			.conflicts(
				'experimental-unsafe-ide-integration',
				'experimental-devtools'
			)
			.showHelpOnFail(false)
			.fail((msg, err, yargsInstance) => {
				if (err) {
					throw err;
				}
				if (msg && msg.includes('Please specify a command')) {
					yargsInstance.showHelp();
					console.error('\n' + msg);
					process.exit(1);
				}
				console.error(msg);
				process.exit(1);
			})
			.strictOptions()
			.check(async (args) => {
				if (args['skip-wordpress-install'] === true) {
					args['wordpress-install-mode'] =
						'do-not-attempt-installing';
					args['wordpressInstallMode'] = 'do-not-attempt-installing';
				}

				if (
					args['wp'] !== undefined &&
					typeof args['wp'] === 'string' &&
					!isValidWordPressSlug(args['wp'])
				) {
					try {
						// Check if is valid URL
						new URL(args['wp']);
					} catch {
						throw new Error(
							'Unrecognized WordPress version. Please use "latest", a URL, or a numeric version such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
						);
					}
				}

				const siteUrlArg = args['site-url'];
				if (
					typeof siteUrlArg === 'string' &&
					siteUrlArg.trim() !== ''
				) {
					try {
						new URL(siteUrlArg);
					} catch {
						throw new Error(
							`Invalid site-url "${siteUrlArg}". Please provide a valid URL (e.g., http://localhost:8080 or https://example.com)`
						);
					}
				}

				if (args['auto-mount']) {
					let autoMountIsDir = false;
					try {
						const autoMountStats = fs.statSync(
							args['auto-mount'] as string
						);
						autoMountIsDir = autoMountStats.isDirectory();
					} catch {
						autoMountIsDir = false;
					}

					if (!autoMountIsDir) {
						throw new Error(
							`The specified --auto-mount path is not a directory: '${args['auto-mount']}'.`
						);
					}
				}

				if (args['experimental-blueprints-v2-runner'] === true) {
					// TODO: Remove this once we have reworked the Blueprints v2 runner.
					throw new Error(
						'Blueprints v2 are temporarily disabled while we rework their runtime implementation.'
					);

					if (args['mode'] !== undefined) {
						if (args['wordpress-install-mode'] !== undefined) {
							throw new Error(
								'The --wordpress-install-mode option cannot be used with the --mode option. Use one or the other.'
							);
						}
						if ('skip-sqlite-setup' in args) {
							throw new Error(
								'The --skipSqliteSetup option is not supported in Blueprint V2 mode.'
							);
						}
						if (args['auto-mount'] !== undefined) {
							throw new Error(
								'The --mode option cannot be used with --auto-mount because --auto-mount automatically sets the mode.'
							);
						}
					} else {
						// Support the legacy v1 runner options
						if (
							args['wordpress-install-mode'] ===
							'do-not-attempt-installing'
						) {
							args['mode'] = 'apply-to-existing-site';
						} else {
							args['mode'] = 'create-new-site';
						}
					}

					// Support the legacy v1 runner options
					const allow = (args['allow'] as string[]) || [];

					if (args['followSymlinks'] === true) {
						allow.push('follow-symlinks');
					}

					if (args['blueprint-may-read-adjacent-files'] === true) {
						allow.push('read-local-fs');
					}

					args['allow'] = allow;
				} else {
					if (args['mode'] !== undefined) {
						throw new Error(
							'The --mode option requires the --experimentalBlueprintsV2Runner flag.'
						);
					}
				}

				return true;
			});

		yargsObject.wrap(yargsObject.terminalWidth());
		const args = await yargsObject.argv;

		const command = args._[0] as string;

		if (
			!['start', 'run-blueprint', 'server', 'build-snapshot'].includes(
				command
			)
		) {
			yargsObject.showHelp();
			process.exit(1);
		}

		const define = (args['define'] || {}) as Record<string, string>;
		if (
			!('WP_DEBUG' in define) &&
			!('WP_DEBUG_LOG' in define) &&
			!('WP_DEBUG_DISPLAY' in define)
		) {
			define['WP_DEBUG'] = 'true';
			define['WP_DEBUG_LOG'] = 'true';
			define['WP_DEBUG_DISPLAY'] = 'true';
		}

		const cliArgs = {
			...args,
			define,
			command,
			mount: [
				...((args['mount'] as Mount[]) || []),
				...((args['mount-dir'] as Mount[]) || []),
			],
			'mount-before-install': [
				...((args['mount-before-install'] as Mount[]) || []),
				...((args['mount-dir-before-install'] as Mount[]) || []),
			],
		} as RunCLIArgs;

		const cliServer = await runCLI(cliArgs);
		if (cliServer === undefined) {
			// No server was started, so we are done with our work.
			process.exit(0);
		}

		const cleanUpCliAndExit = (() => {
			// Remember we are already cleaning up to preclude the possibility
			// of multiple, conflicting cleanup attempts.
			let promiseToCleanup: Promise<void>;

			return async () => {
				if (promiseToCleanup === undefined) {
					promiseToCleanup = cliServer[Symbol.asyncDispose]();
				}
				await promiseToCleanup;
				process.exit(0);
			};
		})();

		// Playground CLI server must be killed to exit. From the terminal,
		// this may occur via Ctrl+C which sends SIGINT. Let's handle both
		// SIGINT and SIGTERM (the default kill signal) to make sure we
		// clean up after ourselves even if this process is being killed.
		// NOTE: Windows does not support SIGTERM, but Node.js provides some emulation.
		process.on('SIGINT', cleanUpCliAndExit);
		process.on('SIGTERM', cleanUpCliAndExit);

		return {
			[Symbol.asyncDispose]: async () => {
				process.off('SIGINT', cleanUpCliAndExit);
				process.off('SIGTERM', cleanUpCliAndExit);
				await cliServer[Symbol.asyncDispose]();
			},
			[internalsKeyForTesting]: { cliServer },
		};
	} catch (e) {
		console.error(e);
		if (!(e instanceof Error)) {
			throw e;
		}
		const debug = process.argv.includes('--debug');
		if (debug) {
			printDebugDetails(e);
		} else {
			const messageChain = [];
			let currentError = e;
			do {
				messageChain.push(currentError.message);
				currentError = currentError.cause as Error;
			} while (currentError instanceof Error);
			console.error(
				'\x1b[1m' + messageChain.join(' caused by: ') + '\x1b[0m'
			);
		}
		process.exit(1);
	}
}

function getMountForVfsPath(
	mounts: Mount[],
	vfsPath: string
): Mount | undefined {
	return mounts.find(
		(mount) =>
			mount.vfsPath.replace(/\/$/, '') === vfsPath.replace(/\/$/, '')
	);
}

export interface RunCLIArgs {
	blueprint?:
		| BlueprintV1Declaration
		| BlueprintV2Declaration
		| BlueprintBundle;
	command: 'start' | 'server' | 'run-blueprint' | 'build-snapshot';
	debug?: boolean;
	login?: boolean;
	mount?: Mount[];
	'mount-before-install'?: Mount[];
	outfile?: string;
	php?: SupportedPHPVersion;
	port?: number;
	'site-url'?: string;
	quiet?: boolean;
	verbosity?: LogVerbosity;
	wp?: string;
	autoMount?: string;
	pathAliases?: PathAlias[];
	experimentalTrace?: boolean;
	internalCookieStore?: boolean;
	'additional-blueprint-steps'?: any[];
	intl?: boolean;
	phpmyadmin?: boolean | string;
	redis?: boolean;
	memcached?: boolean;
	xdebug?: boolean | { ideKey?: string };
	experimentalUnsafeIdeIntegration?: string[];
	experimentalDevtools?: boolean;
	'experimental-blueprints-v2-runner'?: boolean;
	wordpressInstallMode?: WordPressInstallMode;
	/**
	 * PHP string constants defined via --define flag.
	 * Set via php.defineConstant(), process-specific only.
	 */
	define?: Record<string, string>;
	/**
	 * PHP boolean constants defined via --define-bool flag.
	 * Set via php.defineConstant(), process-specific only.
	 */
	'define-bool'?: Record<string, boolean>;
	/**
	 * PHP number constants defined via --define-number flag.
	 * Set via php.defineConstant(), process-specific only.
	 */
	'define-number'?: Record<string, number>;

	// --------- Blueprint V1 args -----------
	skipSqliteSetup?: boolean;
	followSymlinks?: boolean;
	'blueprint-may-read-adjacent-files'?: boolean;

	// --------- Blueprint V2 args -----------
	mode?: 'mount-only' | 'create-new-site' | 'apply-to-existing-site';

	// --------- Blueprint V2 args (not available via CLI yet) -----------
	'db-engine'?: 'sqlite' | 'mysql';
	'db-host'?: string;
	'db-user'?: string;
	'db-pass'?: string;
	'db-name'?: string;
	'db-path'?: string;
	'truncate-new-site-directory'?: boolean;
	allow?: string;

	// --------- Start command args -----------
	path?: string;
	skipBrowser?: boolean;
	noAutoMount?: boolean;
	reset?: boolean;
}

// TODO: Maybe we should just be declaring an interface instead of a type union
export type PlaygroundCliWorker =
	| PlaygroundCliBlueprintV1Worker
	| PlaygroundCliBlueprintV2Worker;

export const internalsKeyForTesting = Symbol('playground-cli-testing');

export interface RunCLIServer extends AsyncDisposable {
	playground: Pooled<PlaygroundCliWorker>;
	server: Server;
	serverUrl: string;

	[Symbol.asyncDispose](): Promise<void>;

	// Provide some details and helpers for automated testing.
	[internalsKeyForTesting]: {
		workerThreadCount: number;
	};
}

const bold = (text: string) =>
	process.stdout.isTTY ? '\x1b[1m' + text + '\x1b[0m' : text;

const red = (text: string) =>
	process.stdout.isTTY ? '\x1b[31m' + text + '\x1b[0m' : text;

const dim = (text: string) =>
	process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text;

const italic = (text: string) =>
	process.stdout.isTTY ? `\x1b[3m${text}\x1b[0m` : text;

const highlight = (text: string) =>
	process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text;

// These overloads are declared for convenience so runCLI() can return
// different things depending on the CLI command without forcing the
// callers (mostly automated tests) to check return values.

// Re-export merge functions from defines.ts
export { mergeDefinedConstants } from './defines';

export async function runCLI(
	args: RunCLIArgs & { command: 'build-snapshot' | 'run-blueprint' }
): Promise<void>;
export async function runCLI(
	args: RunCLIArgs & { command: 'start' }
): Promise<RunCLIServer>;
export async function runCLI(
	args: RunCLIArgs & { command: 'server' }
): Promise<RunCLIServer>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void> {
	let playgroundPool: Pooled<PlaygroundCliWorker>;
	const cookieStore = args.internalCookieStore
		? new HttpCookieStore()
		: undefined;

	const spawnedWorkers: SpawnedWorker[] = [];
	const workerToPlaygroundMap: Map<
		// TODO: Can this just be the worker, not a data structure with a port?
		SpawnedWorker,
		RemoteAPI<PlaygroundCliWorker>
	> = new Map();

	if (args.command === 'start') {
		args = expandStartCommandArgs(args);
	}

	if (args.autoMount !== undefined) {
		if (args.autoMount === '') {
			// No auto-mount path was provided, so use the current working directory.
			// Note: We default here instead of in the yargs declaration because
			// it allows us to test the default as part of the runCLI() unit tests.
			args = { ...args, autoMount: process.cwd() };
		}
		args = expandAutoMounts(args);
	}

	if (args.wordpressInstallMode === undefined) {
		args.wordpressInstallMode = 'download-and-install';
	}

	// Keeping the '--quiet' option to preserve backward compatibility
	if (args.quiet) {
		args.verbosity = 'quiet';
		delete args['quiet'];
	}
	// Keeping the '--debug' option to preserve backward compatibility
	if (args.debug) {
		args.verbosity = 'debug';
		delete args['debug'];
	}

	if (args.verbosity) {
		const severity = Object.values(LogVerbosity).find(
			(v) => v.name === args.verbosity
		)!.severity;
		logger.setSeverityFilterLevel(severity);
	}

	// Enables Intl dynamic extension by default
	if (!args.intl) {
		args.intl = true;
	}

	// Enable Redis dynamic extension by default only when JSPI is available.
	// Redis requires JSPI for proper exception handling during network operations.
	if (args.redis === undefined) {
		args.redis = await jspi();
	}

	// Memcached extension is opt-in via --memcached flag.
	// It requires JSPI support, so users must run with Node.js 23+ and --experimental-wasm-jspi flag.
	if (args.memcached === undefined) {
		args.memcached = await jspi();
	}

	// Setup phpMyAdmin if enabled.
	if (args.phpmyadmin) {
		if (true === args.phpmyadmin) {
			args.phpmyadmin = '/phpmyadmin';
		}

		if (args.skipSqliteSetup) {
			throw new Error(
				'--phpmyadmin requires SQLite. Cannot be used with --skip-sqlite-setup.'
			);
		}

		// Set up path alias for phpMyAdmin.
		args['pathAliases'] = [
			{
				urlPrefix: args.phpmyadmin,
				fsPath: PHPMYADMIN_INSTALL_PATH,
			},
		];
	}

	// Create CLI output handler
	const cliOutput = new CLIOutput({
		verbosity: args.verbosity || 'normal',
	});

	// Display banner for server commands
	if (args.command === 'server') {
		cliOutput.printBanner();
		cliOutput.printConfig({
			phpVersion: args.php || RecommendedPHPVersion,
			wpVersion: args.wp || 'latest',
			port: (args['port'] as number) || 9400,
			xdebug: !!args.xdebug,
			intl: !!args.intl,
			redis: !!args.redis,
			memcached: !!args.memcached,
			mounts: [
				...(args.mount || []),
				...(args['mount-before-install'] || []),
			],
			blueprint:
				typeof args.blueprint === 'string' ? args.blueprint : undefined,
		});
	}

	const selectedPort =
		args.command === 'server' ? ((args['port'] as number) ?? 9400) : 0;

	// Declare file lock manager outside scope of startServer
	// so we can look at it when debugging request handling.
	const fileLockManager = new FileLockManagerInMemory();

	let wordPressReady = false;
	let isFirstRequest = true;

	const server = await startServer({
		port: selectedPort,
		onBind: async (server: Server, port: number) => {
			const host = '127.0.0.1';
			const serverUrl = `http://${host}:${port}`;
			const siteUrl = args['site-url'] || serverUrl;

			const targetWorkerCount = Math.max(
				cpus().length - 1,
				MINIMUM_WORKER_COUNT
			);

			/*
			 * Use a real temp dir as a target for the following Playground paths
			 * so that multiple worker threads can share the same files.
			 *  - /internal
			 *  - /tmp
			 *  - /wordpress
			 *
			 * Sharing the same files leads to faster boot times and uses less memory
			 * because we don't have to create or maintain multiple copies of the same files.
			 */
			const tempDirNameDelimiter = '-playground-cli-site-';
			const nativeDir =
				await createPlaygroundCliTempDir(tempDirNameDelimiter);
			logger.debug(`Native temp dir for VFS root: ${nativeDir.path}`);

			const IDEConfigName = 'WP Playground CLI - Listen for Xdebug';

			// Always clean up any existing Playground files symlink in the project root.
			const symlinkName = '.playground-xdebug-root';
			const symlinkPath = path.join(process.cwd(), symlinkName);

			await removeTempDirSymlink(symlinkPath);

			// Then, if xdebug, and experimental IDE are enabled,
			// recreate the symlink pointing to the temporary
			// directory and add the new IDE config.
			if (args.xdebug && args.experimentalUnsafeIdeIntegration) {
				await createTempDirSymlink(
					nativeDir.path,
					symlinkPath,
					process.platform
				);

				const symlinkMount: Mount = {
					hostPath: path.join('.', path.sep, symlinkName),
					vfsPath: '/',
				};

				try {
					// NOTE: Both the 'clear' and 'add' operations can throw errors.
					await clearXdebugIDEConfig(IDEConfigName, process.cwd());

					const xdebugOptions =
						typeof args.xdebug === 'object'
							? args.xdebug
							: undefined;
					const modifiedConfig = await addXdebugIDEConfig({
						name: IDEConfigName,
						host: host,
						port: port,
						ides: args.experimentalUnsafeIdeIntegration!,
						cwd: process.cwd(),
						mounts: [
							symlinkMount,
							...(args['mount-before-install'] || []),
							...(args.mount || []),
						],
						ideKey: xdebugOptions?.ideKey,
					});

					// Display IDE-specific instructions
					const ides = args.experimentalUnsafeIdeIntegration;
					const hasVSCode = ides.includes('vscode');
					const hasPhpStorm = ides.includes('phpstorm');
					const configFiles = Object.values(modifiedConfig);

					console.log('');

					if (configFiles.length > 0) {
						console.log(bold(`Xdebug configured successfully`));
						console.log(
							highlight(`Updated IDE config: `) +
								configFiles.join(' ')
						);
						console.log(
							highlight('Playground source root: ') +
								`.playground-xdebug-root` +
								italic(
									dim(
										` – you can set breakpoints and preview Playground's VFS structure in there.`
									)
								)
						);
					} else {
						console.log(bold(`Xdebug configuration failed.`));
						console.log(
							'No IDE-specific project settings directory was found in the current working directory.'
						);
					}

					console.log('');

					if (hasVSCode && modifiedConfig['vscode']) {
						console.log(bold('VS Code / Cursor instructions:'));
						console.log(
							'  1. Ensure you have installed an IDE extension for PHP Debugging'
						);
						console.log(
							`     (The ${bold('PHP Debug')} extension by ${bold(
								'Xdebug'
							)} has been a solid option)`
						);
						console.log(
							'  2. Open the Run and Debug panel on the left sidebar'
						);
						console.log(
							`  3. Select "${italic(
								IDEConfigName
							)}" from the dropdown`
						);
						console.log('  3. Click "start debugging"');
						console.log(
							'  5. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php'
						);
						console.log(
							'  6. Visit Playground in your browser to hit the breakpoint'
						);
						if (hasPhpStorm) {
							console.log('');
						}
					}

					if (hasPhpStorm && modifiedConfig['phpstorm']) {
						console.log(bold('PhpStorm instructions:'));
						console.log(
							`  1. Choose "${italic(
								IDEConfigName
							)}" debug configuration in the toolbar`
						);
						console.log('  2. Click the debug button (bug icon)`');
						console.log(
							'  3. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php'
						);
						console.log(
							'  4. Visit Playground in your browser to hit the breakpoint'
						);
					}

					console.log('');
				} catch (error) {
					throw new Error('Could not configure Xdebug', {
						cause: error,
					});
				}
			}

			// We do not know the system temp dir,
			// but we can try to infer from the location of the current temp dir.
			const tempDirRoot = path.dirname(nativeDir.path);

			const twoDaysInMillis = 2 * 24 * 60 * 60 * 1000;
			const tempDirStaleAgeInMillis = twoDaysInMillis;

			// NOTE: This is an async operation, but we do not care to block on it.
			// Let's let the cleanup happen as the main thread has time.
			cleanupStalePlaygroundTempDirs(
				tempDirNameDelimiter,
				tempDirStaleAgeInMillis,
				tempDirRoot
			);

			// NOTE: We do not add mount declarations for /internal here
			// because it will be mounted as part of php-wasm init.
			const nativeInternalDirPath = path.join(nativeDir.path, 'internal');
			mkdirSync(nativeInternalDirPath);

			const userProvidableNativeSubdirs = [
				'wordpress',
				'tools',
				// Note: These dirs are from Emscripten's "default dirs" list:
				// https://github.com/emscripten-core/emscripten/blob/f431ec220e472e1f8d3db6b52fe23fb377facf30/src/lib/libfs.js#L1400-L1402
				//
				// Any Playground process with multiple workers may assume
				// these are part of a shared filesystem, so let's recognize
				// them explicitly here.
				'tmp',
				'home',
			];

			for (const subdirName of userProvidableNativeSubdirs) {
				const isMountingSubdirName = (mount: Mount) =>
					mount.vfsPath === `/${subdirName}`;
				const thisSubdirHasAMount =
					args['mount-before-install']?.some(isMountingSubdirName) ||
					args['mount']?.some(isMountingSubdirName);
				if (!thisSubdirHasAMount) {
					// The user hasn't requested mounting a different native dir for this path,
					// so let's create a mount from within our native temp dir.
					const nativeSubdirPath = path.join(
						nativeDir.path,
						subdirName
					);
					mkdirSync(nativeSubdirPath);

					if (args['mount-before-install'] === undefined) {
						args['mount-before-install'] = [];
					}

					// Make the real mount first so any further subdirs are mounted into it.
					args['mount-before-install'].unshift({
						vfsPath: `/${subdirName}`,
						hostPath: nativeSubdirPath,
					});
				}
			}

			if (args['mount-before-install']) {
				for (const mount of args['mount-before-install']) {
					logger.debug(
						`Mount before WP install: ${mount.vfsPath} -> ${mount.hostPath}`
					);
				}
			}
			if (args['mount']) {
				for (const mount of args['mount']) {
					logger.debug(
						`Mount after WP install: ${mount.vfsPath} -> ${mount.hostPath}`
					);
				}
			}

			let handler: BlueprintsV1Handler | BlueprintsV2Handler;
			if (args['experimental-blueprints-v2-runner']) {
				handler = new BlueprintsV2Handler(args, {
					siteUrl,
					cliOutput,
				});
			} else {
				handler = new BlueprintsV1Handler(args, {
					siteUrl,
					cliOutput,
				});

				if (typeof args.blueprint === 'string') {
					args.blueprint = await resolveBlueprint({
						sourceString: args.blueprint,
						blueprintMayReadAdjacentFiles:
							args['blueprint-may-read-adjacent-files'] === true,
					});
				}
			}

			// Remember whether we are already disposing so we can avoid:
			// - we can avoid multiple, conflicting dispose attempts
			// - logging that a worker exited while the CLI itself is exiting
			let disposing = false;
			const disposeCLI = async function disposeCLI() {
				if (disposing) {
					return;
				}

				disposing = true;
				await Promise.all(
					spawnedWorkers.map(async (spawnedWorker) => {
						await workerToPlaygroundMap
							.get(spawnedWorker)
							?.dispose();
						await spawnedWorker.worker.terminate();
					})
				);
				if (server) {
					await new Promise((resolve) => {
						server.close(resolve);
						server.closeAllConnections();
					});
				}
				await nativeDir.cleanup();
			};

			try {
				const promisesToBoot = [];
				const workerType = handler.getWorkerType();
				for (
					let workerIndex = 0;
					workerIndex < targetWorkerCount;
					workerIndex++
				) {
					const promiseToBoot = spawnWorkerThread(workerType, {
						onExit: (exitCode: number) => {
							// We are already disposing, so worker exit is expected
							// and does not need to be logged.
							if (disposing) {
								return;
							}

							if (exitCode !== 0) {
								return;
							}

							logger.error(
								`Worker ${workerIndex} exited with code ${exitCode}\n`
							);
							// @TODO: Should we respawn the worker if it exited with an error and the CLI is not shutting down?
						},
					}).then(
						async (
							spawnResult: SpawnedWorker
						): Promise<
							[
								SpawnedWorker,
								(
									| RemoteAPI<PlaygroundCliBlueprintV1Worker>
									| RemoteAPI<PlaygroundCliBlueprintV2Worker>
								),
							]
						> => {
							// Remember the worker process before booting the Playground
							// so we can clean it up if there is an error during boot.
							spawnedWorkers.push(spawnResult);

							const fileLockManagerPort =
								await exposeFileLockManager(fileLockManager);
							const playgroundApi =
								await handler.bootRequestHandler({
									worker: spawnResult,
									fileLockManagerPort,
									nativeInternalDirPath,
								});

							workerToPlaygroundMap.set(
								spawnResult,
								playgroundApi
							);

							return [spawnResult, playgroundApi];
						}
					);

					promisesToBoot.push(promiseToBoot);

					// TODO: Remove this workaround after we remove the inherent race
					// from @wp-playground/wordpress's bootRequestHandler() function.
					if (workerIndex === 0) {
						// Wait for the first worker to boot to avoid a race condition
						// with writing initial PHP files in bootRequestHandler().
						// This is the race condition:
						// https://github.com/WordPress/wordpress-playground/blob/e758ee0893d199416a2d740195815234584b1b44/packages/playground/wordpress/src/boot.ts#L416-L426
						// Multiple workers may detect that .boot-files-written does not exist
						// and proceed to try to write initial boot files.
						await promiseToBoot;
					}
				}

				await Promise.all(promisesToBoot);
				playgroundPool = createObjectPoolProxy(
					spawnedWorkers.map(
						(spawnedWorker) =>
							workerToPlaygroundMap.get(spawnedWorker)!
					)
				);

				// NOTE: Using a free-standing block to isolate initial boot vars
				// while keeping the logic inline.
				{
					// TODO: Consider how to avoid Xdebug being enabled during boot.

					const messageChannelForPostInstallMounts =
						new NodeMessageChannel();
					const mainThreadPostInstallMountsPort =
						messageChannelForPostInstallMounts.port1;
					const workerPostInstallMountsPort =
						messageChannelForPostInstallMounts.port2;
					await exposeAPI(
						{
							applyPostInstallMountsToAllWorkers: async () => {
								await Promise.all(
									Array.from(
										workerToPlaygroundMap.values()
									).map((playground) =>
										playground!.mountAfterWordPressInstall(
											args['mount'] || []
										)
									)
								);
							},
						},
						undefined,
						mainThreadPostInstallMountsPort
					);
					await handler.bootWordPress(
						playgroundPool,
						workerPostInstallMountsPort
					);
					mainThreadPostInstallMountsPort.close();

					wordPressReady = true;

					if (!args['experimental-blueprints-v2-runner']) {
						const compiledBlueprint = await (
							handler as BlueprintsV1Handler
						).compileInputBlueprint(
							args['additional-blueprint-steps'] || []
						);

						if (compiledBlueprint) {
							await runBlueprintV1Steps(
								compiledBlueprint,
								playgroundPool
							);
						}
					}

					// If phpMyAdmin is enabled and not already installed, install it.
					if (
						args.phpmyadmin &&
						!(await playgroundPool.fileExists(
							`${PHPMYADMIN_INSTALL_PATH}/index.php`
						))
					) {
						const steps = await getPhpMyAdminInstallSteps();
						const compiled = await compileBlueprintV1({ steps });
						await runBlueprintV1Steps(compiled, playgroundPool);
					}

					if (args.command === 'build-snapshot') {
						await zipSite(playgroundPool, args.outfile as string);
						cliOutput.printStatus(`Exported to ${args.outfile}`);
						await disposeCLI();
						return;
					} else if (args.command === 'run-blueprint') {
						cliOutput.finishProgress('Done');
						await disposeCLI();
						return;
					}
				}

				cliOutput.finishProgress();
				cliOutput.printReady(serverUrl, targetWorkerCount);

				if (args.phpmyadmin) {
					const phpMyAdminPath = path.join(
						args.phpmyadmin as string,
						PHPMYADMIN_ENTRY_PATH
					);
					cliOutput.printPhpMyAdminUrl(
						new URL(phpMyAdminPath, serverUrl).toString()
					);
				}

				if (args.xdebug && args.experimentalDevtools) {
					const bridge = await startBridge({
						phpInstance: playgroundPool,
						phpRoot: '/wordpress',
					});

					bridge.start();
				}

				return {
					playground: playgroundPool,
					server,
					serverUrl,
					[Symbol.asyncDispose]: disposeCLI,
					[internalsKeyForTesting]: {
						workerThreadCount: targetWorkerCount,
					},
				};
			} catch (error) {
				if (args.verbosity !== 'debug') {
					throw error;
				}
				let phpLogs = '';
				if (await playgroundPool?.fileExists(errorLogPath)) {
					phpLogs = await playgroundPool.readFileAsText(errorLogPath);
				}
				await disposeCLI();
				throw new Error(phpLogs, { cause: error });
			}
		},
		async handleRequest(request: PHPRequest) {
			if (!wordPressReady) {
				return PHPResponse.forHttpCode(
					502,
					'WordPress is not ready yet'
				);
			}
			// Clear the playground_auto_login_already_happened cookie on the first request.
			// Otherwise the first Playground CLI server started on the machine will set it,
			// all the subsequent runs will get the stale cookie, and the auto-login will
			// assume they don't have to auto-login again.
			if (isFirstRequest) {
				isFirstRequest = false;
				const headers: Record<string, string[]> = {
					'Content-Type': ['text/plain'],
					'Content-Length': ['0'],
					Location: [request.url],
				};
				if (
					request.headers?.['cookie']?.includes(
						'playground_auto_login_already_happened'
					)
				) {
					headers['Set-Cookie'] = [
						'playground_auto_login_already_happened=1; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/',
					];
				}
				return new PHPResponse(302, headers, new Uint8Array());
			}
			if (cookieStore) {
				request = {
					...request,
					headers: {
						...request.headers,
						// While we have an internal cookie store, we
						// completely replace the incoming request's Cookie
						// header with the cookies from our store. This avoids
						// getting into a strange state where both browser and
						// server are managing cookies.
						cookie: cookieStore.getCookieRequestHeader(),
					},
				};
			}

			// TODO: Explore switching to a worker thread method to adopt an entire HTTP connection
			// It might be more efficient to let the worker respond directly
			const response = await playgroundPool.request(request);

			if (cookieStore) {
				cookieStore.rememberCookiesFromResponseHeaders(
					response.headers
				);
				// While we have an internal cookie store, we filter out the
				// Set-Cookie headers from responses so the browser does not
				// attempt to manage cookies at the same time as the server.
				delete response.headers['set-cookie'];
			}

			return response;
		},
	});

	if (server && args.command === 'start' && !args.skipBrowser) {
		openInBrowser(server.serverUrl);
	}
	return server;
}

/**
 * Transforms CLI args for the `start` command into the `server` command arguments.
 *
 * (Yes, the `start` command is just a convenience wrapper to provide useful defaults
 * for the `server` command.)
 */
function expandStartCommandArgs(
	args: RunCLIArgs & { reset?: boolean }
): RunCLIArgs {
	let newArgs = { ...args, command: 'server' };

	/**
	 * Enable auto-mount unless explicitly disabled
	 */
	if (!args.noAutoMount) {
		newArgs.autoMount = path.resolve(process.cwd(), newArgs['path'] ?? '');
		newArgs = expandAutoMounts(newArgs as RunCLIArgs);
		// Delete the autoMount argument to avoid double expansion later on.
		delete newArgs.autoMount;
	}

	const existingSiteRootMount =
		getMountForVfsPath(
			newArgs['mount-before-install'] || [],
			'/wordpress'
		) || getMountForVfsPath(newArgs.mount || [], '/wordpress');

	/**
	 * Persist the site into a ~/.wordpress-playground/sites/<site-id> directory,
	 * but only if we don't have an explicit mount for the /wordpress VFS path.
	 *
	 * Why the limitation?
	 *
	 * Because we can only do one of the two:
	 *
	 * 1. Mount host path /my/wordpress/site directory at /wordpress VFS path
	 * 2. Mount host path ~/.wordpress-playground/sites/<site-id> directory at /wordpress VFS path
	 *
	 * When either the user or expandAutoMounts() already provided a mount for the /wordpress VFS path,
	 * it means a WordPress installation is already present in that directory. In this case, that's our
	 * persistent store.
	 */
	if (!existingSiteRootMount) {
		/**
		 * Persist the sites by default by mounting a real, stable directory
		 * as the site root.
		 */
		const currentSitePath = newArgs['autoMount'] || process.cwd();
		const currentSiteHash = createHash('sha256')
			.update(currentSitePath as string)
			.digest('hex');

		const homeDir = os.homedir();
		const hostPath = path.join(
			homeDir,
			'.wordpress-playground/sites',
			currentSiteHash
		);
		console.log('Site files stored at:', hostPath);

		if (existsSync(hostPath) && (args['reset'] as boolean)) {
			console.log('Resetting site...');
			rmdirSync(hostPath, { recursive: true });
		}
		mkdirSync(hostPath, { recursive: true });
		newArgs['mount-before-install'] = [
			...((newArgs['mount-before-install'] || []) as Mount[]),
			{ vfsPath: '/wordpress', hostPath },
		];

		newArgs.wordpressInstallMode =
			readdirSync(hostPath).length === 0
				? // Only download WordPress on the first run when the site directory is still
					// empty.
					'download-and-install'
				: // After that, reuse the WordPress installation from the initial run.
					'install-from-existing-files-if-needed';
	} else {
		console.log('Site files stored at:', existingSiteRootMount?.hostPath);
		if (args['reset']) {
			console.log(``);
			console.log(
				red(
					`This site is not managed by Playground CLI and cannot be reset.`
				)
			);
			console.log(
				`(It's not stored in the ~/.wordpress-playground/sites/<site-id> directory.)`
			);
			console.log(``);
			console.log(
				`You may still remove the site's directory manually if you wish.`
			);
			process.exit(1);
		}
	}

	return newArgs as RunCLIArgs;
}

const processIdAllocator = new ProcessIdAllocator();

export type SpawnedWorker = {
	processId: number;
	worker: Worker;
	phpPort: NodeMessagePort;
};

/**
 * A statically analyzable function that spawns a worker thread of a given type.
 *
 * **Important:** This function builds to code that has the worker URL hardcoded
 * inline, e.g. `new Worker(new URL('./worker-thread-v1.js', import.meta.url))`.
 * This allows the downstream consumers to statically analyze the code, recognize
 * it uses workers, create new entrypoints, and rewrite the new Worker() calls.
 *
 * @param workerType
 * @returns
 */
export function spawnWorkerThread(
	workerType: 'v1' | 'v2',
	{ onExit }: { onExit?: (code: number) => void } = {}
) {
	/**
	 * When running the CLI from source via `node cli.ts`, the Vite-provided
	 * __WORKER_V1_URL__ and __WORKER_V2_URL__ are undefined. Let's set them to
	 * the correct paths.
	 */
	if (typeof __WORKER_V1_URL__ === 'undefined') {
		// @ts-expect-error
		globalThis['__WORKER_V1_URL__'] = './blueprints-v1/worker-thread-v1.ts';
	}
	if (typeof __WORKER_V2_URL__ === 'undefined') {
		// @ts-expect-error
		globalThis['__WORKER_V2_URL__'] = './blueprints-v2/worker-thread-v2.ts';
	}
	let worker: Worker;
	if (workerType === 'v1') {
		worker = new Worker(new URL(__WORKER_V1_URL__, import.meta.url));
	} else {
		worker = new Worker(new URL(__WORKER_V2_URL__, import.meta.url));
	}

	return new Promise<SpawnedWorker>((resolve, reject) => {
		const processId = processIdAllocator.claim();

		worker.once('message', function (message: any) {
			// Let the worker confirm it has initialized.
			// We could use the 'online' event to detect start of JS execution,
			// but that would miss initialization errors.
			if (message.command === 'worker-script-initialized') {
				resolve({
					processId,
					worker,
					phpPort: message.phpPort,
				});
			}
		});
		worker.once('error', function (e: Error) {
			processIdAllocator.release(processId);

			console.error(e);
			const error = new Error(
				`Worker failed to load worker. ${
					e.message ? `Original error: ${e.message}` : ''
				}`
			);
			reject(error);
		});
		let spawned = false;
		worker.once('spawn', () => {
			spawned = true;
		});
		worker.once('exit', (code) => {
			processIdAllocator.release(processId);

			if (!spawned) {
				reject(new Error(`Worker exited before spawning: ${code}`));
			}
			onExit?.(code);
		});
	});
}

/**
 * Expose the file lock manager API on a MessagePort and return it.
 *
 * @see comlink-sync.ts
 * @see phpwasm-emscripten-library-file-locking-for-node.js
 */
async function exposeFileLockManager(fileLockManager: FileLockManagerInMemory) {
	const { port1, port2 } = new NodeMessageChannel();
	/**
	 * Always expose a synchronous API for the file lock manager
	 * so our injected system call overrides don't have to switch
	 * between synchronous and asynchronous APIs.
	 *
	 * @todo: Fill in the file containing the injected file locking system calls.
	 * @see comlink-sync.ts
	 * @see phpwasm-emscripten-library-file-locking-for-node.js
	 */
	await exposeSyncAPI(fileLockManager, port1);
	return port2;
}

/**
 * Open a URL in the user's default browser.
 * Works cross-platform: macOS, Windows, and Linux.
 */
function openInBrowser(url: string): void {
	const platform = os.platform();
	let command: string;

	switch (platform) {
		case 'darwin':
			command = `open "${url}"`;
			break;
		case 'win32':
			command = `start "" "${url}"`;
			break;
		default:
			// Linux and other Unix-like systems
			command = `xdg-open "${url}"`;
			break;
	}

	exec(command, (error) => {
		if (error) {
			// Don't fail the CLI if browser opening fails, just log a debug message
			logger.debug(`Could not open browser: ${error.message}`);
		}
	});
}

async function zipSite(
	playground: Pooled<PlaygroundCliWorker>,
	outfile: string
) {
	await playground.run({
		code: `<?php
		$zip = new ZipArchive();
		if(false === $zip->open('/tmp/build.zip', ZipArchive::CREATE | ZipArchive::OVERWRITE)) {
			throw new Exception('Failed to create ZIP');
		}
		$files = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator('/wordpress')
		);
		foreach ($files as $file) {
			echo $file . PHP_EOL;
			if (!$file->isFile()) {
				continue;
			}
			$zip->addFile($file->getPathname(), $file->getPathname());
		}
		$zip->close();

	`,
	});
	const zip = await playground.readFileAsBuffer('/tmp/build.zip');
	fs.writeFileSync(outfile, zip);
}
