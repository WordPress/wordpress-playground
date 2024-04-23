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
import { PHPRequestHandler, writeFiles } from '@php-wasm/universal';
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
import {
	proxyFileSystem,
	requestedWPVersion,
	createPhp,
	startupOptions,
	monitoredFetch,
	downloadMonitor,
} from './worker-utils';
import {
	FilesystemOperation,
	journalFSEvents,
	replayFSJournal,
} from '@php-wasm/fs-journal';

const scope = Math.random().toFixed(16);

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

// Start downloading WordPress if needed
let wordPressRequest = null;
if (!wordPressAvailableInOPFS) {
	if (requestedWPVersion.startsWith('http')) {
		// We don't know the size upfront, but we can still monitor the download.
		// monitorFetch will read the content-length response header when available.
		wordPressRequest = monitoredFetch(requestedWPVersion);
	} else {
		const wpDetails = getWordPressModuleDetails(startupOptions.wpVersion);
		downloadMonitor.expectAssets({
			[wpDetails.url]: wpDetails.size,
		});
		wordPressRequest = monitoredFetch(wpDetails.url);
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

	constructor(
		requestHandler: PHPRequestHandler<WebPHP>,
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string
	) {
		super(requestHandler, monitor);
		this.scope = scope;
		this.wordPressVersion = wordPressVersion;
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
			php: this.__internal_getPHP()!,
			opfs,
			onProgress,
		});
	}

	async journalFSEvents(
		root: string,
		callback: (op: FilesystemOperation) => void
	) {
		return journalFSEvents(this.__internal_getPHP()!, root, callback);
	}

	async replayFSJournal(events: FilesystemOperation[]) {
		return replayFSJournal(this.__internal_getPHP()!, events);
	}
}

const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const requestHandler = new PHPRequestHandler({
	phpFactory: async ({ isPrimary }) => {
		const php = await createPhp(requestHandler);
		if (!isPrimary) {
			proxyFileSystem(
				await requestHandler.getPrimaryPhp(),
				php,
				requestHandler.documentRoot
			);
		}
		return php;
	},
	documentRoot: DOCROOT,
	absoluteUrl: scopedSiteUrl,
	rewriteRules: wordPressRewriteRules,
});
const apiEndpoint = new PlaygroundWorkerEndpoint(
	requestHandler,
	downloadMonitor,
	scope,
	startupOptions.wpVersion
);
const [setApiReady, setAPIError] = exposeAPI(apiEndpoint);

try {
	const primaryPhp = await requestHandler.getPrimaryPhp();
	await apiEndpoint.setPrimaryPHP(primaryPhp);

	// If WordPress isn't already installed, download and extract it from
	// the zip file.
	if (!wordPressAvailableInOPFS) {
		await unzip(primaryPhp, {
			zipFile: new File(
				[await (await wordPressRequest!).blob()],
				'wp.zip'
			),
			extractToPath: requestHandler.documentRoot,
		});

		// Randomize the WordPress secrets
		await defineWpConfigConsts(primaryPhp, {
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
	await writeFiles(
		primaryPhp,
		joinPaths(requestHandler.documentRoot, '/wp-content/mu-plugins'),
		{
			'0-playground.php': playgroundMuPlugin,
			'playground-includes/wp_http_dummy.php': transportDummy,
			'playground-includes/wp_http_fetch.php': transportFetch,
		}
	);
	// Create phpinfo.php
	primaryPhp.writeFile(
		joinPaths(requestHandler.documentRoot, 'phpinfo.php'),
		'<?php phpinfo(); '
	);
	// Create phpinfo.php
	primaryPhp.writeFile(
		joinPaths(requestHandler.documentRoot, 'self-request.php'),
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
	primaryPhp.writeFile(
		joinPaths(requestHandler.documentRoot, 'next.php'),
		`<?php 
	echo "YAY, self-request worked!";
	`
	);

	primaryPhp.writeFile(
		joinPaths(requestHandler.documentRoot, 'run-php-file.php'),
		`<?php 
	echo shell_exec('php /wordpress/next.php');
	echo "After";
	`
	);

	if (virtualOpfsDir) {
		await bindOpfs({
			php: primaryPhp,
			opfs: virtualOpfsDir!,
			wordPressAvailableInOPFS,
		});
	}

	// Always setup the current site URL.
	await defineSiteUrl(primaryPhp, {
		siteUrl: scopedSiteUrl,
	});

	setApiReady();
} catch (e) {
	setAPIError(e as Error);
	throw e;
}
