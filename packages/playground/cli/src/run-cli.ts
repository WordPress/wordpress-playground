import { errorLogPath, logger, LogSeverity } from '@php-wasm/logger';
import type {
	PHPRequest,
	RemoteAPI,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHPResponse,
	exposeAPI,
	exposeSyncAPI,
	printDebugDetails,
} from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintV1Declaration,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import { runBlueprintV1Steps } from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import fs, { mkdirSync } from 'fs';
import type { Server } from 'http';
import { MessageChannel as NodeMessageChannel, Worker } from 'worker_threads';
// @ts-ignore
import {
	expandAutoMounts,
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
} from './mounts';
import { startServer } from './start-server';
import type {
	Mount,
	PlaygroundCliBlueprintV1Worker,
} from './blueprints-v1/worker-thread-v1';
import type { PlaygroundCliBlueprintV2Worker } from './blueprints-v2/worker-thread-v2';
import { FileLockManagerForNode } from '@php-wasm/node';
import { LoadBalancer } from './load-balancer';
/* eslint-disable no-console */
import { SupportedPHPVersions } from '@php-wasm/universal';
import { cpus } from 'os';
import { jspi } from 'wasm-feature-detect';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import yargs from 'yargs';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import { resolveBlueprint } from './resolve-blueprint';
import { BlueprintsV2Handler } from './blueprints-v2/blueprints-v2-handler';
import { BlueprintsV1Handler } from './blueprints-v1/blueprints-v1-handler';
import { startBridge } from '@php-wasm/xdebug-bridge';
import path from 'path';
import os from 'os';
import {
	cleanupStalePlaygroundTempDirs,
	createPlaygroundCliTempDir,
} from './temp-dir';
import {
	addXdebugIDEConfig,
	clearXdebugIDEConfig,
	createPlaygroundCliTempDirSymlink,
	removePlaygroundCliTempDirSymlink,
} from './xdebug-path-mappings';

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

export async function parseOptionsAndRunCLI() {
	try {
		/**
		 * @TODO This looks similar to Query API args https://wordpress.github.io/wordpress-playground/developers/apis/query-api/
		 *       Perhaps the two could be handled by the same code?
		 */
		const yargsObject = yargs(process.argv.slice(2))
			.usage('Usage: wp-playground <command> [options]')
			.positional('command', {
				describe: 'Command to run',
				choices: ['server', 'run-blueprint', 'build-snapshot'] as const,
				demandOption: true,
			})
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
				// coerce: parseMountDirArguments,
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
			.option('skip-wordpress-setup', {
				describe:
					'Do not download, unzip, and install WordPress. Useful for mounting a pre-configured WordPress directory at /wordpress.',
				type: 'boolean',
				default: false,
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
			.option('experimental-multi-worker', {
				describe:
					'Enable experimental multi-worker support which requires ' +
					'a /wordpress directory backed by a real filesystem. ' +
					'Pass a positive number to specify the number of workers to use. ' +
					'Otherwise, default to the number of CPUs minus 1.',
				type: 'number',
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
			.strictOptions()
			.check(async (args) => {
				// Support multiple spellings of "WordPress"
				if (
					args['skip-wordpress-setup'] ||
					args['skipWordpressSetup']
				) {
					args['skipWordPressSetup'] = true;
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
					if (args['experimental-multi-worker'] <= 1) {
						throw new Error(
							'The --experimental-multi-worker flag must be a positive integer greater than 1.'
						);
					}
				}

				if (args['experimental-blueprints-v2-runner'] === true) {
					if (args['mode'] !== undefined) {
						if ('skip-wordpress-setup' in args) {
							throw new Error(
								'The --skipWordPressSetup option cannot be used with the --mode option. Use one or the other.'
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
						if (args['skip-wordpress-setup'] === true) {
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

		await runCLI(cliArgs);
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
				'\x1b[1m' + messageChain.join(' caused by ') + '\x1b[0m'
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
	experimentalMultiWorker?: number;
	experimentalTrace?: boolean;
	exitOnPrimaryWorkerCrash?: boolean;
	internalCookieStore?: boolean;
	'additional-blueprint-steps'?: any[];
	xdebug?: boolean | { ideKey?: string };
	experimentalUnsafeIdeIntegration?: string[];
	experimentalDevtools?: boolean;
	'experimental-blueprints-v2-runner'?: boolean;

	// --------- Blueprint V1 args -----------
	skipWordPressSetup?: boolean;
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

type PlaygroundCliWorker =
	| PlaygroundCliBlueprintV1Worker
	| PlaygroundCliBlueprintV2Worker;

export interface RunCLIServer extends AsyncDisposable {
	playground: RemoteAPI<PlaygroundCliWorker>;
	server: Server;
	serverUrl: string;

	[Symbol.asyncDispose](): Promise<void>;

	// Expose the number of worker threads to the test runner.
	workerThreadCount: number;
}

const bold = (text: string) =>
	process.stdout.isTTY ? '\x1b[1m' + text + '\x1b[0m' : text;

const dim = (text: string) =>
	process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text;

const italic = (text: string) =>
	process.stdout.isTTY ? `\x1b[3m${text}\x1b[0m` : text;

const highlight = (text: string) =>
	process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text;

export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer> {
	let loadBalancer: LoadBalancer;
	let playground: RemoteAPI<PlaygroundCliWorker>;

	const playgroundsToCleanUp: {
		playground: RemoteAPI<PlaygroundCliWorker>;
		worker: Worker;
	}[] = [];

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

	// Declare file lock manager outside scope of startServer
	// so we can look at it when debugging request handling.
	const nativeFlockSync =
		os.platform() === 'win32'
			? // @TODO: Enable fs-ext here when it works with Windows.
			  undefined
			: await import('fs-ext')
					.then((m) => m.flockSync)
					.catch(() => {
						logger.warn(
							'The fs-ext package is not installed. ' +
								'Internal file locking will not be integrated with ' +
								'host OS file locking.'
						);
						return undefined;
					});
	const fileLockManager = new FileLockManagerForNode(nativeFlockSync);

	let wordPressReady = false;
	let isFirstRequest = true;

	logger.log('Starting a PHP server...');

	return startServer({
		port: args['port'] as number,
		onBind: async (server: Server, port: number): Promise<RunCLIServer> => {
			const host = '127.0.0.1';
			const serverUrl = `http://${host}:${port}`;
			const siteUrl = args['site-url'] || serverUrl;

			// Create the blueprints handler
			const totalWorkerCount = args.experimentalMultiWorker ?? 1;
			const processIdSpaceLength = Math.floor(
				Number.MAX_SAFE_INTEGER / totalWorkerCount
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
			const nativeDirPath = await createPlaygroundCliTempDir(
				tempDirNameDelimiter
			);
			logger.debug(`Native temp dir for VFS root: ${nativeDirPath}`);

			const IDEConfigName = 'WP Playground CLI - Listen for Xdebug';

			// Always clean up any existing Playground files symlink in the project root.
			const symlinkName = '.playground-xdebug-root';
			const symlinkPath = path.join(process.cwd(), symlinkName);

			await removePlaygroundCliTempDirSymlink(symlinkPath);

			// Then, if xdebug, and experimental IDE are enabled,
			// recreate the symlink pointing to the temporary
			// directory and add the new IDE config.
			if (args.xdebug && args.experimentalUnsafeIdeIntegration) {
				await createPlaygroundCliTempDirSymlink(
					nativeDirPath,
					symlinkPath,
					process.platform
				);

				const symlinkMount: Mount = {
					hostPath: `./${symlinkName}`,
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

					console.log('');
					console.log(bold(`Xdebug configured successfully`));
					console.log(
						highlight(`Updated IDE config: `) +
							modifiedConfig.join(' ')
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
					console.log('');

					if (hasVSCode) {
						console.log(bold('VS Code / Cursor instructions:'));
						console.log(
							'  1. Open the Run and Debug panel on the left sidebar'
						);
						console.log(
							`  2. Select "${italic(
								IDEConfigName
							)}" from the dropdown`
						);
						console.log('  3. Click "start debugging"');
						console.log(
							'  4. Set a breakpoint. For example, in .playground-xdebug-root/wordpress/index.php'
						);
						console.log(
							'  5. Visit Playground in your browser to hit the breakpoint'
						);
						if (hasPhpStorm) {
							console.log('');
						}
					}

					if (hasPhpStorm) {
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
					logger.error(
						'Could not configure Xdebug:',
						(error as Error)?.message
					);
					process.exit(1);
				}
			}

			// We do not know the system temp dir,
			// but we can try to infer from the location of the current temp dir.
			const tempDirRoot = path.dirname(nativeDirPath);

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
			const nativeInternalDirPath = path.join(nativeDirPath, 'internal');
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
					const nativeSubdirPath = path.join(
						nativeDirPath,
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
					processIdSpaceLength,
				});
			} else {
				handler = new BlueprintsV1Handler(args, {
					siteUrl,
					processIdSpaceLength,
				});

				if (typeof args.blueprint === 'string') {
					args.blueprint = await resolveBlueprint({
						sourceString: args.blueprint,
						blueprintMayReadAdjacentFiles:
							args['blueprint-may-read-adjacent-files'] === true,
					});
				}
			}

			// Kick off worker threads now to save time later.
			// There is no need to wait for other async processes to complete.
			const promisedWorkers = spawnWorkerThreads(
				totalWorkerCount,
				handler.getWorkerType(),
				({ exitCode, isMain, workerIndex }) => {
					if (exitCode === 0) {
						return;
					}
					logger.error(
						`Worker ${workerIndex} exited with code ${exitCode}\n`
					);
					// If the primary worker crashes, exit the entire process.
					if (!isMain) {
						return;
					}
					if (!args.exitOnPrimaryWorkerCrash) {
						return;
					}
					process.exit(1);
				}
			);

			logger.log(`Setting up WordPress ${args.wp}`);

			try {
				const [initialWorker, ...additionalWorkers] =
					await promisedWorkers;

				const fileLockManagerPort = await exposeFileLockManager(
					fileLockManager
				);

				// Boot the primary worker using the handler
				playground = await handler.bootPrimaryWorker(
					initialWorker.phpPort,
					fileLockManagerPort,
					nativeInternalDirPath
				);
				playgroundsToCleanUp.push({
					playground,
					worker: initialWorker.worker,
				});

				await playground.isReady();
				wordPressReady = true;
				logger.log(`Booted!`);

				loadBalancer = new LoadBalancer(playground);

				if (!args['experimental-blueprints-v2-runner']) {
					const compiledBlueprint = await (
						handler as BlueprintsV1Handler
					).compileInputBlueprint(
						args['additional-blueprint-steps'] || []
					);

					if (compiledBlueprint) {
						logger.log(`Running the Blueprint...`);
						await runBlueprintV1Steps(
							compiledBlueprint,
							playground
						);
						logger.log(`Finished running the blueprint`);
					}
				}

				if (args.command === 'build-snapshot') {
					await zipSite(playground, args.outfile as string);
					logger.log(`WordPress exported to ${args.outfile}`);
					process.exit(0);
				} else if (args.command === 'run-blueprint') {
					logger.log(`Blueprint executed`);
					process.exit(0);
				}

				if (
					args.experimentalMultiWorker &&
					args.experimentalMultiWorker > 1
				) {
					logger.log(`Preparing additional workers...`);

					// Boot additional workers using the handler
					const initialWorkerProcessIdSpace = processIdSpaceLength;
					await Promise.all(
						additionalWorkers.map(async (worker, index) => {
							const firstProcessId =
								initialWorkerProcessIdSpace +
								index * processIdSpaceLength;

							const fileLockManagerPort =
								await exposeFileLockManager(fileLockManager);

							const additionalPlayground =
								await handler.bootSecondaryWorker({
									worker,
									fileLockManagerPort,
									firstProcessId,
									nativeInternalDirPath,
								});

							playgroundsToCleanUp.push({
								playground: additionalPlayground,
								worker: worker.worker,
							});

							loadBalancer.addWorker(additionalPlayground);
						})
					);
				}

				logger.log(
					`WordPress is running on ${serverUrl} with ${totalWorkerCount} worker(s)`
				);

				if (args.xdebug && args.experimentalDevtools) {
					const bridge = await startBridge({
						phpInstance: playground,
						phpRoot: '/wordpress',
					});

					bridge.start();
				}

				return {
					playground,
					server,
					serverUrl,
					[Symbol.asyncDispose]: async function disposeCLI() {
						await Promise.all(
							playgroundsToCleanUp.map(
								async ({ playground, worker }) => {
									await playground.dispose();
									await worker.terminate();
								}
							)
						);
						await new Promise((resolve) => server.close(resolve));
					},
					workerThreadCount: totalWorkerCount,
				};
			} catch (error) {
				if (!args.debug) {
					throw error;
				}
				let phpLogs = '';
				if (await playground?.fileExists(errorLogPath)) {
					phpLogs = await playground.readFileAsText(errorLogPath);
				}
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
			return await loadBalancer.handleRequest(request);
		},
	});
}

export type SpawnedWorker = {
	worker: Worker;
	phpPort: NodeMessagePort;
};

async function spawnWorkerThreads(
	count: number,
	workerType: WorkerType,
	onWorkerExit: (options: {
		exitCode: number;
		isMain: boolean;
		workerIndex: number;
	}) => void
): Promise<SpawnedWorker[]> {
	const promises = [];
	for (let i = 0; i < count; i++) {
		const worker = await spawnWorkerThread(workerType);
		const onExit: (code: number) => void = (code: number) => {
			onWorkerExit({
				exitCode: code,
				isMain: i === 0,
				workerIndex: i,
			});
		};
		promises.push(
			new Promise<{ worker: Worker; phpPort: NodeMessagePort }>(
				(resolve, reject) => {
					worker.once('message', function (message: any) {
						// Let the worker confirm it has initialized.
						// We could use the 'online' event to detect start of JS execution,
						// but that would miss initialization errors.
						if (message.command === 'worker-script-initialized') {
							resolve({ worker, phpPort: message.phpPort });
						}
					});
					worker.once('error', function (e: Error) {
						console.error(e);
						const error = new Error(
							`Worker failed to load worker. ${
								e.message ? `Original error: ${e.message}` : ''
							}`
						);
						reject(error);
					});
					worker.once('exit', onExit);
				}
			)
		);
	}
	return Promise.all(promises);
}

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
async function spawnWorkerThread(workerType: 'v1' | 'v2') {
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
	if (workerType === 'v1') {
		return new Worker(new URL(__WORKER_V1_URL__, import.meta.url));
	} else {
		return new Worker(new URL(__WORKER_V2_URL__, import.meta.url));
	}
}

/**
 * Expose the file lock manager API on a MessagePort and return it.
 *
 * @see comlink-sync.ts
 * @see phpwasm-emscripten-library-file-locking-for-node.js
 */
async function exposeFileLockManager(fileLockManager: FileLockManagerForNode) {
	const { port1, port2 } = new NodeMessageChannel();
	if (await jspi()) {
		/**
		 * When JSPI is available, the worker thread expects an asynchronous API.
		 *
		 * @see worker-thread.ts
		 * @see comlink-sync.ts
		 * @see phpwasm-emscripten-library-file-locking-for-node.js
		 */
		exposeAPI(fileLockManager, null, port1);
	} else {
		/**
		 * When JSPI is not available, the worker thread expects a synchronous API.
		 *
		 * @see worker-thread.ts
		 * @see comlink-sync.ts
		 * @see phpwasm-emscripten-library-file-locking-for-node.js
		 */
		await exposeSyncAPI(fileLockManager, port1);
	}
	return port2;
}

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
