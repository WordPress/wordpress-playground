import { WebPHP, WebPHPEndpoint, exposeAPI } from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { DOCROOT, wordPressSiteUrl } from './config';
import {
	getWordPressModuleDetails,
	LatestSupportedWordPressVersion,
	SupportedWordPressVersions,
	SupportedWordPressVersionsList,
	wordPressRewriteRules,
} from '@wp-playground/wordpress';
import {
	PHPResponse,
	SupportedPHPExtension,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
	__private__dont__use,
	rotatePHPRuntime,
	writeFiles,
} from '@php-wasm/universal';
import { createSpawnHandler, phpVar } from '@php-wasm/util';
import {
	FilesystemOperation,
	journalFSEvents,
	replayFSJournal,
} from '@php-wasm/fs-journal';
import {
	SyncProgressCallback,
	bindOpfs,
	playgroundAvailableInOpfs,
} from './opfs/bind-opfs';
import {
	defineSiteUrl,
	defineWpConfigConsts,
	unzip,
} from '@wp-playground/blueprints';

/** @ts-ignore */
import transportFetch from './playground-mu-plugin/playground-includes/wp_http_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './playground-mu-plugin/playground-includes/wp_http_dummy.php?raw';
/** @ts-ignore */
import playgroundMuPlugin from './playground-mu-plugin/0-playground.php?raw';
import { joinPaths, randomString } from '@php-wasm/util';

// post message to parent
self.postMessage('worker-script-started');

type StartupOptions = {
	wpVersion?: string;
	phpVersion?: string;
	sapiName?: string;
	storage?: string;
	phpExtension?: string[];
};
const startupOptions: StartupOptions = {};
if (typeof self?.location?.href !== 'undefined') {
	const params = new URL(self.location.href).searchParams;
	startupOptions.wpVersion = params.get('wpVersion') || undefined;
	startupOptions.phpVersion = params.get('phpVersion') || undefined;
	startupOptions.storage = params.get('storage') || undefined;
	// Default to CLI to support the WP-CLI Blueprint step
	startupOptions.sapiName = params.get('sapiName') || 'cli';
	startupOptions.phpExtension = params.getAll('php-extension');
}

const requestedWPVersion = startupOptions.wpVersion || '';
const wpVersion: string = SupportedWordPressVersionsList.includes(
	requestedWPVersion
)
	? requestedWPVersion
	: LatestSupportedWordPressVersion;

const requestedPhpVersion = startupOptions.phpVersion || '';
const phpVersion: SupportedPHPVersion = SupportedPHPVersionsList.includes(
	requestedPhpVersion
)
	? (requestedPhpVersion as SupportedPHPVersion)
	: '8.0';

const phpExtensions = (startupOptions.phpExtension ||
	[]) as SupportedPHPExtension[];

let virtualOpfsRoot: FileSystemDirectoryHandle | undefined;
let virtualOpfsDir: FileSystemDirectoryHandle | undefined;
let lastOpfsDir: FileSystemDirectoryHandle | undefined;
let wordPressAvailableInOPFS = false;
if (
	startupOptions.storage === 'browser' &&
	// @ts-ignore
	typeof navigator?.storage?.getDirectory !== 'undefined'
) {
	virtualOpfsRoot = await navigator.storage.getDirectory();
	virtualOpfsDir = await virtualOpfsRoot.getDirectoryHandle('wordpress', {
		create: true,
	});
	lastOpfsDir = virtualOpfsDir;
	wordPressAvailableInOPFS = await playgroundAvailableInOpfs(virtualOpfsDir!);
}

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const monitor = new EmscriptenDownloadMonitor();

// Start downloading WordPress if needed
let wordPressRequest = null;
if (!wordPressAvailableInOPFS) {
	if (requestedWPVersion.startsWith('http')) {
		// We don't know the size upfront, but we can still monitor the download.
		// monitorFetch will read the content-length response header when available.
		wordPressRequest = monitor.monitorFetch(fetch(requestedWPVersion));
	} else {
		const wpDetails = getWordPressModuleDetails(wpVersion);
		monitor.expectAssets({
			[wpDetails.url]: wpDetails.size,
		});
		wordPressRequest = monitor.monitorFetch(fetch(wpDetails.url));
	}
}

const php = new WebPHP(undefined, {
	documentRoot: DOCROOT,
	absoluteUrl: scopedSiteUrl,
	rewriteRules: wordPressRewriteRules,
});

const recreateRuntime = async () =>
	await WebPHP.loadRuntime(phpVersion, {
		downloadMonitor: monitor,
		// We don't yet support loading specific PHP extensions one-by-one.
		// Let's just indicate whether we want to load all of them.
		loadAllExtensions: phpExtensions?.length > 0,
		requestHandler: {
			rewriteRules: wordPressRewriteRules,
		},
	});

// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
rotatePHPRuntime({
	php,
	recreateRuntime,
	// 400 is an arbitrary number that should trigger a rotation
	// way before the memory gets too fragmented. If the memory
	// issue returns, let's explore:
	// * Lowering this number
	// * Adding a memory usage monitor and rotate based on that
	maxRequests: 400,
});

/** @inheritDoc PHPClient */
export class PlaygroundWorkerEndpoint extends WebPHPEndpoint {
	/**
	 * A string representing the scope of the Playground instance.
	 */
	scope: string;

	/**
	 * A string representing the version of WordPress being used.
	 */
	wordPressVersion: string;

	/**
	 * A string representing the version of PHP being used.
	 */
	phpVersion: string;

	constructor(
		php: WebPHP,
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string,
		phpVersion: string
	) {
		super(php, monitor);
		this.scope = scope;
		this.wordPressVersion = wordPressVersion;
		this.phpVersion = phpVersion;
	}

	/**
	 * @returns WordPress module details, including the static assets directory and default theme.
	 */
	async getWordPressModuleDetails() {
		return {
			majorVersion: this.wordPressVersion,
			staticAssetsDirectory: `wp-${this.wordPressVersion.replace(
				'_',
				'.'
			)}`,
		};
	}

	async getSupportedWordPressVersions() {
		return {
			all: SupportedWordPressVersions,
			latest: LatestSupportedWordPressVersion,
		};
	}

	async resetVirtualOpfs() {
		if (!virtualOpfsRoot) {
			throw new Error('No virtual OPFS available.');
		}
		await virtualOpfsRoot.removeEntry(virtualOpfsDir!.name, {
			recursive: true,
		});
	}

	async reloadFilesFromOpfs() {
		await this.bindOpfs(lastOpfsDir!);
	}

	async bindOpfs(
		opfs: FileSystemDirectoryHandle,
		onProgress?: SyncProgressCallback
	) {
		lastOpfsDir = opfs;
		await bindOpfs({
			php,
			opfs,
			onProgress,
		});
	}

	async journalFSEvents(
		root: string,
		callback: (op: FilesystemOperation) => void
	) {
		return journalFSEvents(php, root, callback);
	}

	async replayFSJournal(events: FilesystemOperation[]) {
		return replayFSJournal(php, events);
	}
}

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpoint(php, monitor, scope, wpVersion, phpVersion)
);

try {
	php.initializeRuntime(await recreateRuntime());

	if (startupOptions.sapiName) {
		await php.setSapiName(startupOptions.sapiName);
	}
	const docroot = php.documentRoot;

	// If WordPress isn't already installed, download and extract it from
	// the zip file.
	if (!wordPressAvailableInOPFS) {
		await unzip(php, {
			zipFile: new File(
				[await (await wordPressRequest!).blob()],
				'wp.zip'
			),
			extractToPath: DOCROOT,
		});

		// Randomize the WordPress secrets
		await defineWpConfigConsts(php, {
			consts: {
				WP_DEBUG: true,
				WP_DEBUG_LOG: true,
				WP_DEBUG_DISPLAY: false,
				AUTH_KEY: randomString(40),
				SECURE_AUTH_KEY: randomString(40),
				LOGGED_IN_KEY: randomString(40),
				NONCE_KEY: randomString(40),
				AUTH_SALT: randomString(40),
				SECURE_AUTH_SALT: randomString(40),
				LOGGED_IN_SALT: randomString(40),
				NONCE_SALT: randomString(40),
			},
		});
	}

	// Always install the playground mu-plugin, even if WordPress is loaded
	// from the OPFS. This ensures:
	// * The mu-plugin is always there, even when a custom WordPress directory
	//   is mounted.
	// * The mu-plugin is always up to date.
	await writeFiles(php, joinPaths(docroot, '/wp-content/mu-plugins'), {
		'0-playground.php': playgroundMuPlugin,
		'playground-includes/wp_http_dummy.php': transportDummy,
		'playground-includes/wp_http_fetch.php': transportFetch,
	});

	if (virtualOpfsDir) {
		await bindOpfs({
			php,
			opfs: virtualOpfsDir!,
			wordPressAvailableInOPFS,
		});
	}

	// Create phpinfo.php
	php.writeFile(joinPaths(docroot, 'phpinfo.php'), '<?php phpinfo(); ');

	// Always setup the current site URL.
	await defineSiteUrl(php, {
		siteUrl: scopedSiteUrl,
	});

	// PHP Subprocess to handle proc_open("php");
	// @TODO: Use this also for HTTP Requests
	let childPHP: WebPHP | undefined = undefined;

	// Spawning new processes on the web is not supported,
	// let's always fail.
	php.setSpawnHandler(
		createSpawnHandler(async function (args, processApi, options) {
			if (args[0] === 'exec') {
				args.shift();
			}

			// Mock programs required by wp-cli:
			if (
				args[0] === '/usr/bin/env' &&
				args[1] === 'stty' &&
				args[2] === 'size'
			) {
				// These numbers are hardcoded because this
				// spawnHandler is transmitted as a string to
				// the PHP backend and has no access to local
				// scope. It would be nice to find a way to
				// transfer / proxy a live object instead.
				// @TODO: Do not hardcode this
				processApi.stdout(`18 140`);
				processApi.exit(0);
			} else if (args[0] === 'less') {
				processApi.on('stdin', (data: Uint8Array) => {
					processApi.stdout(data);
				});
				processApi.flushStdin();
				processApi.exit(0);
			} else if (args[0] === 'fetch') {
				processApi.flushStdin();
				fetch(args[1]).then(async (res) => {
					const reader = res.body?.getReader();
					if (!reader) {
						processApi.exit(1);
						return;
					}
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							processApi.exit(0);
							break;
						}
						processApi.stdout(value);
					}
				});
				return;
			} else if (args[0] === 'php') {
				if (!childPHP) {
					childPHP = new WebPHP(await recreateRuntime(), {
						documentRoot: docroot,
						absoluteUrl: scopedSiteUrl,
					});
					// Pretend to use the CLI SAPI to bypass the check done by WP-CLI.
					childPHP.setSapiName('cli');
					// Share the parent's MEMFS instance with the child process.
					// Only mount the document root and the /tmp directory,
					// the rest of the filesystem (like the devices) should be
					// private to each PHP instance.
					for (const path of [docroot, '/tmp']) {
						if (!childPHP.fileExists(path)) {
							childPHP.mkdir(path);
						}
						childPHP[__private__dont__use].FS.mount(
							childPHP[__private__dont__use].PROXYFS,
							{
								root: path,
								fs: php[__private__dont__use].FS,
							},
							path
						);
					}
				}

				let result: PHPResponse | undefined = undefined;
				try {
					// @TODO: Run the actual PHP CLI SAPI instead of
					//        interpreting the arguments and emulating
					//        the CLI constants and globals.
					const cliBootstrapScript = `<?php
					// Set the argv global.
					$GLOBALS['argv'] = array_merge([
						"/wordpress/wp-cli.phar",
						"--path=/wordpress"
					], ${phpVar(args.slice(2))});

					// Provide stdin, stdout, stderr streams outside of
					// the CLI SAPI.
					define('STDIN', fopen('php://stdin', 'rb'));
					define('STDOUT', fopen('php://stdout', 'wb'));
					define('STDERR', fopen('/tmp/stderr', 'wb'));

					${options.cwd ? 'chdir(getenv("DOCROOT")); ' : ''}
					`;

					if (args.includes('-r')) {
						result = await childPHP.run({
							code: `${cliBootstrapScript} ${
								args[args.indexOf('-r') + 1]
							}`,
							env: options.env,
						});
					} else if (args[1] === 'wp-cli.phar') {
						result = await childPHP.run({
							code: `${cliBootstrapScript} require( "/wordpress/wp-cli.phar" );`,
							env: {
								...options.env,
								// Set SHELL_PIPE to 0 to ensure WP-CLI formats
								// the output as ASCII tables.
								// @see https://github.com/wp-cli/wp-cli/issues/1102
								SHELL_PIPE: '0',
							},
						});
					} else {
						result = await childPHP.run({
							scriptPath: args[1],
							env: options.env,
						});
					}
					processApi.stdout(result.bytes);
					processApi.stderr(result.errors);
					processApi.exit(result.exitCode);
				} catch (e) {
					console.error('Error in childPHP:', e);
					if (e instanceof Error) {
						processApi.stderr(e.message);
					}
					processApi.exit(1);
				}
			} else {
				processApi.exit(1);
			}
		})
	);

	setApiReady();
} catch (e) {
	setAPIError(e as Error);
	throw e;
}
