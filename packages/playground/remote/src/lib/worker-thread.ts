import { WebPHP, WebPHPEndpoint, exposeAPI } from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { DOCROOT, wordPressSiteUrl } from './config';
import {
	getWordPressModuleDetails,
	LatestSupportedWordPressVersion,
	SupportedWordPressVersions,
	wordPressRewriteRules,
} from '@wp-playground/wordpress';
import {
	PHPBrowser,
	PHPPool,
	PHPRequestHandler,
	RequestHandler,
	writeFiles,
} from '@php-wasm/universal';
import { bindOpfs, playgroundAvailableInOpfs } from './opfs/bind-opfs';
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
import {
	requestedWPVersion,
	setupPHP,
	startupOptions,
} from './worker-thread-utils';

// post message to parent
self.postMessage('worker-script-started');

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
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
		const wpDetails = getWordPressModuleDetails(startupOptions.wpVersion);
		monitor.expectAssets({
			[wpDetails.url]: wpDetails.size,
		});
		wordPressRequest = monitor.monitorFetch(fetch(wpDetails.url));
	}
}

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
		phpPool: PHPPool<WebPHP>,
		requestHandler: RequestHandler,
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string,
		phpVersion: string
	) {
		super(phpPool, requestHandler, monitor);
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

	// async reloadFilesFromOpfs() {
	// 	await this.bindOpfs(lastOpfsDir!);
	// }

	// async bindOpfs(
	// 	opfs: FileSystemDirectoryHandle,
	// 	onProgress?: SyncProgressCallback
	// ) {
	// 	lastOpfsDir = opfs;
	// 	await bindOpfs({
	// 		php,
	// 		opfs,
	// 		onProgress,
	// 	});
	// }

	// async journalFSEvents(
	// 	root: string,
	// 	callback: (op: FilesystemOperation) => void
	// ) {
	// 	return journalFSEvents(php, root, callback);
	// }

	// async replayFSJournal(events: FilesystemOperation[]) {
	// 	return replayFSJournal(php, events);
	// }
}

const primary = new WebPHP();
const replicas = [];
for (let i = 0; i < 1; i++) {
	replicas.push(new WebPHP());
}

const pool = new PHPPool(primary, replicas);
const requestHandler = new PHPBrowser(
	new PHPRequestHandler({
		documentRoot: DOCROOT,
		absoluteUrl: scopedSiteUrl,
		rewriteRules: wordPressRewriteRules,
	})
);

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpoint(
		pool,
		requestHandler,
		monitor,
		scope,
		startupOptions.wpVersion,
		startupOptions.phpVersion
	)
);

try {
	for (const instance of pool.instances) {
		await setupPHP(instance, pool, requestHandler);
	}

	const docroot = requestHandler.documentRoot;
	// If WordPress isn't already installed, download and extract it from
	// the zip file.
	if (!wordPressAvailableInOPFS) {
		await unzip(primary, {
			zipFile: new File(
				[await (await wordPressRequest!).blob()],
				'wp.zip'
			),
			extractToPath: docroot,
		});

		// Randomize the WordPress secrets
		await defineWpConfigConsts(primary, {
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
	await writeFiles(primary, joinPaths(docroot, '/wp-content/mu-plugins'), {
		'0-playground.php': playgroundMuPlugin,
		'playground-includes/wp_http_dummy.php': transportDummy,
		'playground-includes/wp_http_fetch.php': transportFetch,
	});
	// Create phpinfo.php
	primary.writeFile(joinPaths(docroot, 'phpinfo.php'), '<?php phpinfo(); ');
	// Create phpinfo.php
	primary.writeFile(
		joinPaths(docroot, 'self-request.php'),
		`<?php 
	require_once('/wordpress/wp-load.php');
	echo "Pre";
	$result = wp_safe_remote_get(
		get_site_url() . '/next.php', 
		array(
			'method' => 'POST',
			'body' => array(
				'key1' => 'value1',
				'key2' => 'value2',
			),
		)
	);
	if ( is_wp_error( $result ) ) {
		print_r($result);
	} else {
		echo wp_remote_retrieve_body( $result );
	}
	echo "Finished";
	`
	);
	primary.writeFile(
		joinPaths(docroot, 'next.php'),
		`<?php 
	echo "YAY, self-request worked!";
	`
	);

	primary.writeFile(
		joinPaths(docroot, 'run-php-file.php'),
		`<?php 
	echo shell_exec('php /wordpress/next.php');
	echo "After";
	`
	);

	if (virtualOpfsDir) {
		await bindOpfs({
			php: primary,
			opfs: virtualOpfsDir!,
			wordPressAvailableInOPFS,
		});
	}

	// Always setup the current site URL.
	await defineSiteUrl(primary, {
		siteUrl: scopedSiteUrl,
	});

	setApiReady();
} catch (e) {
	setAPIError(e as Error);
	throw e;
}
