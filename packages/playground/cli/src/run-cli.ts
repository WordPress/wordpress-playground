import { errorLogPath, logger, LogSeverity } from '@php-wasm/logger';
import type {
	RemoteAPI,
	SupportedPHPVersion,
	UniversalPHP,
} from '@php-wasm/universal';
import { printDebugDetails, releaseRemoteApiProxy } from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintV1Declaration,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import { runBlueprintV1Steps } from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import fs, { mkdirSync } from 'fs';
// @ts-ignore
import {
	expandAutoMounts,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
} from './mounts';
import type { PlaygroundCliBlueprintV1Worker } from './blueprints-v1/worker-thread-v1';
import type { PlaygroundCliBlueprintV2Worker } from './blueprints-v2/worker-thread-v2';
/* eslint-disable no-console */
import { SupportedPHPVersions } from '@php-wasm/universal';
import { cpus } from 'os';
import yargs from 'yargs';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import { resolveBlueprint } from './resolve-blueprint';
import { BlueprintsV2Handler } from './blueprints-v2/blueprints-v2-handler';
import { BlueprintsV1Handler } from './blueprints-v1/blueprints-v1-handler';
import { startBridge } from '@php-wasm/xdebug-bridge';
import path from 'path';
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
import cluster, { type Worker as ClusterProcess } from 'cluster';
import childProcess, { type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

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

const MINIMUM_SERVER_WORKER_COUNT = 5;

/**
 * Parse the CLI args and run the appropriate command.
 *
 * @param argsToParse string[] The CLI args to parse.
 */
export async function parseOptionsAndRunCLI(
	argsToParse: string[]
): Promise<RunCLIServer> {
	try {
		/**
		 * @TODO This looks similar to Query API args https://wordpress.github.io/wordpress-playground/developers/apis/query-api/
		 *       Perhaps the two could be handled by the same code?
		 */
		const yargsObject = yargs(argsToParse)
			.usage('Usage: wp-playground <command> [options]')
			.command('server', 'Start a local WordPress server')
			.command(
				'run-blueprint',
				'Execute a Blueprint without starting a server'
			)
			.command(
				'build-snapshot',
				'Build a ZIP snapshot of a WordPress site based on a Blueprint'
			)
			.demandCommand(1, 'Please specify a command')
			.strictCommands()
			.option('outfile', {
				describe: 'When building, write to this output file.',
				type: 'string',
				default: 'wordpress.zip',
			})
			.option('port', {
				describe: 'Port to listen on when serving.',
				type: 'number',
				default: 9400,
			})
			.option('site-url', {
				describe:
					'Site URL to use for WordPress. Defaults to http://127.0.0.1:{port}',
				type: 'string',
			})
			.option('php', {
				describe: 'PHP version to use.',
				type: 'string',
				default: RecommendedPHPVersion,
				choices: SupportedPHPVersions,
			})
			.option('wp', {
				describe: 'WordPress version to use.',
				type: 'string',
				default: 'latest',
			})
			// @TODO: Support read-only mounts, e.g. via WORKERFS, a custom
			// ReadOnlyNODEFS, or by copying the files into MEMFS
			.option('mount', {
				describe:
					'Mount a directory to the PHP runtime (can be used multiple times). Format: /host/path:/vfs/path',
				type: 'array',
				string: true,
				coerce: parseMountWithDelimiterArguments,
			})
			.option('mount-before-install', {
				describe:
					'Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: /host/path:/vfs/path',
				type: 'array',
				string: true,
				coerce: parseMountWithDelimiterArguments,
			})
			.option('mount-dir', {
				describe:
					'Mount a directory to the PHP runtime (can be used multiple times). Format: "/host/path" "/vfs/path"',
				type: 'array',
				nargs: 2,
				array: true,
				coerce: parseMountDirArguments,
			})
			.option('mount-dir-before-install', {
				describe:
					'Mount a directory before WordPress installation (can be used multiple times). Format: "/host/path" "/vfs/path"',
				type: 'string',
				nargs: 2,
				array: true,
				coerce: parseMountDirArguments,
			})
			.option('login', {
				describe: 'Should log the user in',
				type: 'boolean',
				default: false,
			})
			.option('blueprint', {
				describe: 'Blueprint to execute.',
				type: 'string',
			})
			.option('blueprint-may-read-adjacent-files', {
				describe:
					'Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.',
				type: 'boolean',
				default: false,
			})
			.option('wordpress-install-mode', {
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
			})
			.option('skip-wordpress-install', {
				describe: '[Deprecated] Use --wordpress-install-mode instead.',
				type: 'boolean',
				hidden: true,
			})
			.option('skip-sqlite-setup', {
				describe:
					'Skip the SQLite integration plugin setup to allow the WordPress site to use MySQL.',
				type: 'boolean',
				default: false,
			})
			// Hidden - Deprecated in favor of verbosity
			.option('quiet', {
				describe: 'Do not output logs and progress messages.',
				type: 'boolean',
				default: false,
				hidden: true,
			})
			.option('verbosity', {
				describe: 'Output logs and progress messages.',
				type: 'string',
				choices: Object.values(LogVerbosity).map(
					(verbosity) => verbosity.name
				),
				default: 'normal',
			})
			.option('debug', {
				describe:
					'Print PHP error log content if an error occurs during Playground boot.',
				type: 'boolean',
				default: false,
			})
			.option('auto-mount', {
				describe: `Automatically mount the specified directory. If no path is provided, mount the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.`,
				type: 'string',
			})
			.option('follow-symlinks', {
				describe:
					'Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. \nWarning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.',
				type: 'boolean',
				default: false,
			})
			.option('experimental-trace', {
				describe:
					'Print detailed messages about system behavior to the console. Useful for troubleshooting.',
				type: 'boolean',
				default: false,
				// Hide this option because we want to replace with a more general log-level flag.
				hidden: true,
			})
			.option('internal-cookie-store', {
				describe:
					'Enable internal cookie handling. When enabled, Playground will manage cookies internally using ' +
					'an HttpCookieStore that persists cookies across requests. When disabled, cookies are handled ' +
					'externally (e.g., by a browser in Node.js environments).',
				type: 'boolean',
				default: false,
			})
			.option('intl', {
				describe: 'Enable Intl.',
				type: 'boolean',
				default: true,
			})
			.option('xdebug', {
				describe: 'Enable Xdebug.',
				type: 'boolean',
				default: false,
			})
			.option('experimental-unsafe-ide-integration', {
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
			})
			.option('experimental-devtools', {
				describe: 'Enable experimental browser development tools.',
				type: 'boolean',
			})
			.conflicts(
				'experimental-unsafe-ide-integration',
				'experimental-devtools'
			)
			.option('workers', {
				describe:
					`Specify the number of workers to use for the 'server' command. ` +
					`Must be greater than ${MINIMUM_SERVER_WORKER_COUNT}.`,
				default: Math.max(
					MINIMUM_SERVER_WORKER_COUNT,
					cpus().length - 1
				),
				type: 'number',
			})
			.option('experimental-multi-worker', {
				describe:
					'Enable experimental multi-worker support which requires ' +
					'a /wordpress directory backed by a real filesystem. ' +
					'Pass a positive number to specify the number of workers to use. ' +
					'Otherwise, default to the number of CPUs minus 1.',
				type: 'number',
				deprecated: 'Use --workers instead.',
				coerce: (value?: number) => value ?? cpus().length - 1,
			})
			.option('experimental-blueprints-v2-runner', {
				describe: 'Use the experimental Blueprint V2 runner.',
				type: 'boolean',
				default: false,
				// Remove the "hidden" flag once Blueprint V2 is fully supported
				hidden: true,
			})
			.option('mode', {
				describe:
					'Blueprints v2 runner mode to use. This option is required when using the --experimental-blueprints-v2-runner flag with a blueprint.',
				type: 'string',
				choices: ['create-new-site', 'apply-to-existing-site'],
				// Remove the "hidden" flag once Blueprint V2 is fully supported
				hidden: true,
			})
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

				if (args.wp !== undefined && !isValidWordPressSlug(args.wp)) {
					try {
						// Check if is valid URL
						new URL(args.wp);
					} catch {
						throw new Error(
							'Unrecognized WordPress version. Please use "latest", a URL, or a numeric version such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
						);
					}
				}

				if (args['site-url'] !== undefined && args['site-url'] !== '') {
					try {
						new URL(args['site-url']);
					} catch {
						throw new Error(
							`Invalid site-url "${args['site-url']}". Please provide a valid URL (e.g., http://localhost:8080 or https://example.com)`
						);
					}
				}

				if (args['auto-mount']) {
					let autoMountIsDir = false;
					try {
						const autoMountStats = fs.statSync(args['auto-mount']);
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

				if (args['experimental-multi-worker'] !== undefined) {
					const cliCommand = args._[0] as string;
					if (cliCommand !== 'server') {
						throw new Error(
							'The --experimental-multi-worker flag is only supported when running the server command.'
						);
					}
					if (args['experimental-multi-worker'] <= 1) {
						throw new Error(
							'The --experimental-multi-worker flag must be a positive integer greater than 1.'
						);
					}
				}

				if (args['experimental-blueprints-v2-runner'] === true) {
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

		if (!['run-blueprint', 'server', 'build-snapshot'].includes(command)) {
			yargsObject.showHelp();
			process.exit(1);
		}

		const cliArgs = {
			...args,
			command,
			mount: [...(args.mount || []), ...(args['mount-dir'] || [])],
			'mount-before-install': [
				...(args['mount-before-install'] || []),
				...(args['mount-dir-before-install'] || []),
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
				if (promiseToCleanup !== undefined) {
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

		return cliServer;
	} catch (e) {
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

export interface RunCLIArgs {
	blueprint?:
		| BlueprintV1Declaration
		| BlueprintV2Declaration
		| BlueprintBundle;
	command: 'server' | 'run-blueprint' | 'build-snapshot';
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
	workers?: number;
	experimentalMultiWorker?: number;
	experimentalTrace?: boolean;
	internalCookieStore?: boolean;
	'additional-blueprint-steps'?: any[];
	intl?: boolean;
	xdebug?: boolean | { ideKey?: string };
	experimentalUnsafeIdeIntegration?: string[];
	experimentalDevtools?: boolean;
	'experimental-blueprints-v2-runner'?: boolean;
	wordpressInstallMode?: WordPressInstallMode;

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
}

export type RunCLIArgsWithResolvedRequiredArgs = RunCLIArgs & {
	port: number;
};

type PlaygroundCliWorker =
	| PlaygroundCliBlueprintV1Worker
	| PlaygroundCliBlueprintV2Worker;

export const internalsKeyForTesting = Symbol('playground-cli-testing');

export interface RunCLIServer extends AsyncDisposable {
	playground: RemoteAPI<PlaygroundCliWorker>;
	serverUrl: string;

	[Symbol.asyncDispose](): Promise<void>;

	// Provide some details and helpers for automated testing.
	[internalsKeyForTesting]: {
		workerThreadCount: number;
		getWorkerNumberFromProcessId(processId: number): number;
	};
}

const bold = (text: string) =>
	process.stdout.isTTY ? '\x1b[1m' + text + '\x1b[0m' : text;

const dim = (text: string) =>
	process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text;

const italic = (text: string) =>
	process.stdout.isTTY ? `\x1b[3m${text}\x1b[0m` : text;

const highlight = (text: string) =>
	process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text;

// These overloads are declared for convenience so runCLI() can return
// different things depending on the CLI command without forcing the
// callers (mostly automated tests) to check return values.
export async function runCLI(
	args: RunCLIArgs & { command: 'build-snapshot' | 'run-blueprint' }
): Promise<void>;
export async function runCLI(
	args: RunCLIArgs & { command: 'server' }
): Promise<RunCLIServer>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void> {
	let playground: RemoteAPI<PlaygroundCliWorker> | null = null;

	const playgroundWorkerPairs: Map<
		SpawnedWorker,
		RemoteAPI<PlaygroundCliWorker> | null
	> = new Map();

	if (args.port === undefined) {
		args.port = 9400;
	}

	/**
	 * Expand auto-mounts to include the necessary mounts and steps
	 * when running in auto-mount mode.
	 */
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

	// Keeping 'quiet' option to preserve backward compatibility
	if (args.quiet) {
		args.verbosity = 'quiet';
		delete args['quiet'];
	}

	// Promote "debug" flag to verbosity but keep args.debug around – the
	// program behavior may change in more ways than just logging verbosity
	// when debug mode is enabled, e.g. error objects may carry additional details.
	if (args.debug) {
		args.verbosity = 'debug';
	} else if (args.verbosity === 'debug') {
		args.debug = true;
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

	logger.log('Starting a PHP server...');
	const host = '127.0.0.1';
	const serverUrl = `http://${host}:${args['port'] as number}`;
	const siteUrl = args['site-url'] || serverUrl;

	const targetWorkerCount = (() => {
		if (args.command === 'server') {
			const requestedWorkers =
				args.workers ?? args.experimentalMultiWorker;
			if (requestedWorkers === undefined) {
				return Math.max(MINIMUM_SERVER_WORKER_COUNT, cpus().length - 1);
			}

			if (requestedWorkers < MINIMUM_SERVER_WORKER_COUNT) {
				logger.warn(
					`There were ${args.experimentalMultiWorker} worker(s) requested, ` +
						`but this is less than the minimum required for a server. ` +
						`Using the minimum of ${MINIMUM_SERVER_WORKER_COUNT} workers instead.`
				);
				return MINIMUM_SERVER_WORKER_COUNT;
			}

			return requestedWorkers;
		} else {
			return 1;
		}
	})();

	// Process IDs appear to be defined as `int` in Emscripten:
	// https://github.com/emscripten-core/emscripten/blob/95d2bf9c5c27b88ab7de6eba2d8e61ea1af977ac/system/lib/libc/musl/arch/emscripten/bits/alltypes.h#L290
	// and those are typically 32 bits wide in both 32-bit and 64-bit systems.
	// Apparently, this is a signed type, so we cannot use the leftmost bit.
	const maxValueForSigned32BitInteger = 2 ** (32 - 1) - 1;
	const maxProcessIdValue = maxValueForSigned32BitInteger;
	const processIdSpaceLength = Math.floor(
		maxProcessIdValue / targetWorkerCount
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
	const nativeDir = await createPlaygroundCliTempDir(tempDirNameDelimiter);
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
				typeof args.xdebug === 'object' ? args.xdebug : undefined;
			const modifiedConfig = await addXdebugIDEConfig({
				name: IDEConfigName,
				host: host,
				port: args['port']!,
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
					highlight(`Updated IDE config: `) + configFiles.join(' ')
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
					`  3. Select "${italic(IDEConfigName)}" from the dropdown`
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

	// TODO: File an issue to override Emscripten mkdir to create native top-level dirs.
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
			const nativeSubdirPath = path.join(nativeDir.path, subdirName);
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

	async function applyMountsAfterWordPressInstall(): Promise<void> {
		await Promise.all(
			Array.from(playgroundWorkerPairs.values()).map(
				async (playground) => {
					await playground?.mountAfterWordPressInstall(
						args['mount'] || []
					);
				}
			)
		);
	}

	let handler: BlueprintsV1Handler | BlueprintsV2Handler;
	if (args['experimental-blueprints-v2-runner']) {
		handler = new BlueprintsV2Handler(
			args as RunCLIArgsWithResolvedRequiredArgs,
			{
				siteUrl,
				processIdSpaceLength,
			}
		);
	} else {
		handler = new BlueprintsV1Handler(
			args as RunCLIArgsWithResolvedRequiredArgs,
			{
				siteUrl,
				processIdSpaceLength,
			}
		);

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
			[...playgroundWorkerPairs].map(
				async ([workerProcess, playground]) => {
					await playground?.dispose();
					await playground?.[releaseRemoteApiProxy]();
					await killWorkerProcess(workerProcess);
				}
			)
		);
		await nativeDir.cleanup();
	};

	try {
		logger.log(`Starting workers...`);

		// Kick off worker threads now to save time later.
		// There is no need to wait for other async processes to complete.
		const promisesToBoot = [];
		const workerType = handler.getWorkerType();
		for (
			let workerIndex = 0;
			workerIndex < targetWorkerCount;
			workerIndex++
		) {
			const promiseToBootWorker = spawnWorkerProcess(workerType, {
				onExit(exitCode: number): void {
					// We are already disposing, so worker exit is expected
					// and does not need to be logged.
					if (disposing) {
						return;
					}

					if (exitCode === 0) {
						return;
					}

					logger.error(
						`Worker ${workerIndex} exited with code ${exitCode}\n`
					);
					// @TODO: Should we respawn the worker if it exited with an error and the CLI is not shutting down?
				},
			}).then(
				async (
					workerProcess: SpawnedWorker
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
					playgroundWorkerPairs.set(workerProcess, null);

					const firstProcessId = workerIndex * processIdSpaceLength;

					const playgroundApi = await handler.bootPlayground({
						workerProcess,
						firstProcessId,
						nativeInternalDirPath,
					});

					playgroundWorkerPairs.set(workerProcess, playgroundApi);

					return [workerProcess, playgroundApi];
				}
			);
			promisesToBoot.push(promiseToBootWorker);
		}

		const [[initialWorkerProcess, initialPlayground]] =
			await Promise.all(promisesToBoot);

		// TODO: comment on picking a playground to return to the caller
		playground = playgroundWorkerPairs.values().next().value!;

		// TODO: Restore "WordPress is not ready yet" server response before WP setup?

		await handler.bootWordPress(
			initialWorkerProcess,
			applyMountsAfterWordPressInstall
		);
		playgroundWorkerPairs.set(initialWorkerProcess, initialPlayground);

		await initialPlayground.isReady();
		logger.log(`Booted!`);

		if (!args['experimental-blueprints-v2-runner']) {
			const compiledBlueprint = await (
				handler as BlueprintsV1Handler
			).compileInputBlueprint(args['additional-blueprint-steps'] || []);

			if (compiledBlueprint) {
				logger.log(`Running the Blueprint...`);
				await runBlueprintV1Steps(
					compiledBlueprint,
					initialPlayground as UniversalPHP
				);
				logger.log(`Finished running the blueprint`);
			}
		}

		if (args.command === 'build-snapshot') {
			await zipSite(initialPlayground, args.outfile as string);
			logger.log(`WordPress exported to ${args.outfile}`);
			await disposeCLI();
			return;
		} else if (args.command === 'run-blueprint') {
			logger.log(`Blueprint executed`);
			await disposeCLI();
			return;
		}

		logger.log(
			`WordPress is running on ${serverUrl} with ${targetWorkerCount} worker(s)`
		);

		if (args.xdebug && args.experimentalDevtools) {
			const bridge = await startBridge({
				phpInstance: playground!,
				phpRoot: '/wordpress',
			});

			bridge.start();
		}

		return {
			playground: playground!,
			serverUrl,
			[Symbol.asyncDispose]: disposeCLI,
			[internalsKeyForTesting]: {
				workerThreadCount: targetWorkerCount,
				getWorkerNumberFromProcessId: (processId: number) => {
					return Math.floor(processId / processIdSpaceLength);
				},
			},
		};
	} catch (error) {
		if (!args.debug) {
			throw error;
		}
		let phpLogs = '';
		if (playground && (await playground.fileExists(errorLogPath))) {
			phpLogs = await playground.readFileAsText(errorLogPath);
		}
		await disposeCLI();
		throw new Error(phpLogs, { cause: error });
	}

	// TODO: Restore this for the first Playground CLI request
	// // Clear the playground_auto_login_already_happened cookie on the first request.
	// // Otherwise the first Playground CLI server started on the machine will set it,
	// // all the subsequent runs will get the stale cookie, and the auto-login will
	// // assume they don't have to auto-login again.
	// if (isFirstRequest) {
	// 	isFirstRequest = false;
	// 	const headers: Record<string, string[]> = {
	// 		'Content-Type': ['text/plain'],
	// 		'Content-Length': ['0'],
	// 		Location: [request.url],
	// 	};
	// 	if (
	// 		request.headers?.['cookie']?.includes(
	// 			'playground_auto_login_already_happened'
	// 		)
	// 	) {
	// 		headers['Set-Cookie'] = [
	// 			'playground_auto_login_already_happened=1; Max-Age=0; ' +
	// 			'Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/',
	// 		];
	// 	}
	// 	return new PHPResponse(302, headers, new Uint8Array());
	// }
}

export type SpawnedWorker = ClusterProcess | ChildProcess;

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
export function spawnWorkerProcess(
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
	let workerProcess: SpawnedWorker;

	const fork = cluster.isPrimary
		? (workerUrl: URL) => {
				cluster.setupPrimary({
					exec: fileURLToPath(workerUrl),
					serialization: 'advanced',
				});
				return cluster.fork();
			}
		: // If this is isn't the primary cluster process,
			// we need to spawn a child process instead.
			// In this case, we expect to be spawning workers for proc_open().
			(workerUrl: URL) => {
				// TODO: Probably stop exporting this function and make it an exposed API of the main process
				// TODO: ^ Or, somehow, track all spawned processes and clean them up when the CLI exits.
				return childProcess.fork(workerUrl, {
					stdio: 'inherit',
					serialization: 'advanced',
				});
			};
	if (workerType === 'v1') {
		workerProcess = fork(new URL(__WORKER_V1_URL__, import.meta.url));
	} else {
		workerProcess = fork(new URL(__WORKER_V2_URL__, import.meta.url));
	}

	return new Promise<SpawnedWorker>((resolve, reject) => {
		workerProcess.once('message', function (message: any) {
			// Let the worker confirm it has initialized.
			// We could use the 'online' event to detect start of JS execution,
			// but that would miss initialization errors.
			if (message.command === 'worker-script-initialized') {
				resolve(workerProcess);
			}
		});
		workerProcess.once('error', function (e: Error) {
			console.error(e);
			const error = new Error(
				`Worker failed to load worker. ${
					e.message ? `Original error: ${e.message}` : ''
				}`
			);
			reject(error);
		});
		let spawned = false;
		workerProcess.once('spawn', () => {
			spawned = true;
		});
		workerProcess.once('exit', (code) => {
			if (!spawned) {
				reject(new Error(`Worker exited before spawning: ${code}`));
			}
			// TODO: Should we use a non-zero error code if the process exited due to a signal?
			onExit?.(code ?? 0);
		});
	});
}

// TODO: Move this to the initial worker process so we can
// avoid passing non-JSON-serializable objects to and from the worker.
async function zipSite(
	playground: RemoteAPI<PlaygroundCliWorker>,
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

export function killWorkerProcess(workerProcess: SpawnedWorker): Promise<void> {
	return new Promise<void>((resolve) => {
		workerProcess.on('exit', resolve);
		workerProcess.kill();
	});
}
