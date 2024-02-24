import { CAPem, WebPHP, WebPHPEndpoint, exposeAPI } from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { DOCROOT, wordPressSiteUrl } from './config';
import {
	getWordPressModuleDetails,
	LatestSupportedWordPressVersion,
	SupportedWordPressVersions,
	SupportedWordPressVersionsList,
} from '@wp-playground/wordpress';
import {
	PHPResponse,
	SupportedPHPExtension,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
	rotatePHPRuntime,
	syncFSTo,
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
import { journalFSEventsToPhp } from './opfs/journal-fs-to-php';

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
});

const recreateRuntime = async () =>
	await WebPHP.loadRuntime(phpVersion, {
		downloadMonitor: monitor,
		// We don't yet support loading specific PHP extensions one-by-one.
		// Let's just indicate whether we want to load all of them.
		loadAllExtensions: phpExtensions?.length > 0,
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
	php.setPhpIniEntry('allow_url_fopen', 'On');
	php.setPhpIniEntry('openssl.cafile', '/tmp/ca-bundle.crt');
	php.writeFile('/tmp/ca-bundle.crt', CAPem);
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

	php.writeFile(
		joinPaths(docroot, 'spawn.php'),
		`<?php
		echo "<plaintext>";
		echo "Spawning /wordpress/child.php\n";
		$handle = proc_open('php /wordpress/child.php', [
			0 => ['pipe', 'r'],
			1 => ['pipe', 'w'],
			2 => ['pipe', 'w'],
		], $pipes);

		echo "stdout: " . stream_get_contents($pipes[1]) . "\n";
		echo "stderr: " . stream_get_contents($pipes[2]) . "\n";
		echo "Finished\n";
		echo "Contents of the created file: " . file_get_contents("/wordpress/new.txt") . "\n";
		`
	);

	php.writeFile(
		joinPaths(docroot, 'child.php'),
		`<?php
		echo "<plaintext>";
		echo "Spawned, running";
		error_log("Here's a message logged to stderr! " . rand());
		file_put_contents("/wordpress/new.txt", "Hello, world!" . rand() . "\n");
		`
	);

	// PHP Subprocess to handle proc_open("php");
	// @TODO: Use this also for HTTP Requests
	let childPHP: WebPHP | undefined = undefined;

	// Spawning new processes on the web is not supported,
	// let's always fail.
	php.setSpawnHandler(
		createSpawnHandler(async function (
			[command, ...args],
			processApi,
			options
		) {
			if (command === 'exec') {
				command = args[0];
				args = args.slice(1);
			}

			// Mock programs required by wp-cli:
			if (
				command === '/usr/bin/env' &&
				args[0] === 'stty' &&
				args[1] === 'size'
			) {
				// These numbers are hardcoded because this
				// spawnHandler is transmitted as a string to
				// the PHP backend and has no access to local
				// scope. It would be nice to find a way to
				// transfer / proxy a live object instead.
				// @TODO: Do not hardcode this
				processApi.stdout(`18 140`);
				processApi.exit(0);
				return;
			} else if (command === 'less') {
				processApi.on('stdin', (data: Uint8Array) => {
					processApi.stdout(data);
				});
				processApi.flushStdin();
				processApi.exit(0);
				return;
			} else if (command === 'fetch') {
				console.log('=========== FETCH ==========');
				// processApi.flushStdin();
				fetch(args[0]).then(async (res) => {
					const reader = res.body?.getReader();
					if (!reader) {
						processApi.exit(1);
						return;
					}
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							// exiting the process closes the
							// pipe and PHP can no longer read
							// the response.
							// processApi.exit(0);
							break;
						}
						processApi.stdout(value);
					}
				});
				return;
			} else if (command === 'php') {
				if (!childPHP) {
					childPHP = new WebPHP(await recreateRuntime(), {
						documentRoot: DOCROOT,
						absoluteUrl: scopedSiteUrl,
					});
				} else {
					try {
						// Remove the document root to ensure that the
						// child PHP instance is in a clean state.
						// The journal seems to stay around longer than
						// expected and this `rmdir` removes the `/wordpress`
						// directory in the parent process.
						// @TODO: Fix this
						// childPHP.rmdir(childPHP.documentRoot);
					} catch (e) {
						// Ignore errors
					}
				}
				let unbind = () => {};
				let result: PHPResponse | undefined = undefined;
				try {
					syncFSTo(php, childPHP);
					unbind = journalFSEventsToPhp(
						childPHP,
						php,
						// @TODO: Sync both directories and any other
						//        relevant paths. OR, don't run
						//        blueprints outside of docroot :-)
						childPHP.documentRoot // options.cwd ||
					);
					// @TODO: Run the actual PHP CLI SAPI instead of
					//        interpreting the arguments here.
					if (args.includes('-r')) {
						const script =
							`<?php 
							// @TODO: Run the actual PHP CLI SAPI instead of
							//        polyfilling these streams
							define('STDIN', fopen('php://stdin', 'rb'));
							define('STDOUT', fopen('php://stdout', 'wb'));
							define('STDERR', fopen('/tmp/stderr', 'wb'));
							` +
							(options.cwd ? 'chdir(getenv("DOCROOT")); ' : '') +
							args[args.indexOf('-r') + 1];
						result = await childPHP.run({
							throwOnError: true,
							code: script,
							env: options.env,
						});
					} else {
						result = await childPHP.run({
							throwOnError: true,
							scriptPath: args[0],
						});
					}
					processApi.stdout(result.bytes);
					processApi.stderr(result.errors);
					console.log('Providing exit code', {
						stdout: result.text,
						stderr: result.errors,
						exitCode: result.exitCode,
					});
					processApi.exit(result.exitCode);
				} catch (e) {
					console.error('Error in childPHP:', e);
					if (e instanceof Error) {
						processApi.stderr(e.message);
					}
					processApi.exit(1);
				} finally {
					unbind();
				}
			} else {
				console.error('Unsupported command:', command, args);
				processApi.exit(1);
			}
		})
	);

	console.log('[Worker] setApiReady()::before');
	setApiReady();
	console.log('[Worker] setApiReady()::after');
} catch (e) {
	setAPIError(e as Error);
	throw e;
}
