import { SyncProgressCallback, exposeAPI } from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { joinPaths } from '@php-wasm/util';
import { wordPressSiteUrl } from './config';
import {
	getWordPressModuleDetails,
	LatestSupportedWordPressVersion,
	SupportedWordPressVersions,
	sqliteDatabaseIntegrationModuleDetails,
} from '@wp-playground/wordpress-builds';

import {
	BindOpfsOptions,
	bindOpfs,
	playgroundAvailableInOpfs,
} from './opfs/bind-opfs';
import { randomString } from '@php-wasm/util';
import {
	requestedWPVersion,
	startupOptions,
	monitoredFetch,
	downloadMonitor,
	spawnHandlerFactory,
	createPhpRuntime,
	setStartupOptions,
	waitForStartupOptions,
} from './worker-utils';
import {
	FilesystemOperation,
	journalFSEvents,
	replayFSJournal,
} from '@php-wasm/fs-journal';
/* @ts-ignore */
import transportFetch from './playground-mu-plugin/playground-includes/wp_http_fetch.php?raw';
/* @ts-ignore */
import transportDummy from './playground-mu-plugin/playground-includes/wp_http_dummy.php?raw';
/* @ts-ignore */
import playgroundWebMuPlugin from './playground-mu-plugin/0-playground.php?raw';
import { PHP, PHPWorker } from '@php-wasm/universal';
import {
	bootWordPress,
	getLoadedWordPressVersion,
} from '@wp-playground/wordpress';
import { wpVersionToStaticAssetsDirectory } from '@wp-playground/wordpress-builds';
import { logger } from '@php-wasm/logger';
import { unzipFile } from '@wp-playground/common';

/**
 * Startup options are received from spawnPHPWorkerThread using a message event.
 * We need to wait for startup options to be received to setup the worker thread.
 */
setStartupOptions(await waitForStartupOptions());

const scope = startupOptions.scope;

// post message to parent
self.postMessage('worker-script-started');

let virtualOpfsRoot: FileSystemDirectoryHandle | undefined;
let virtualOpfsDir: FileSystemDirectoryHandle | undefined;
let lastOpfsHandle: FileSystemDirectoryHandle | undefined;
let lastOpfsMountpoint: string | undefined;
let wordPressAvailableInOPFS = false;
if (
	startupOptions.storage === 'browser' &&
	// @ts-ignore
	typeof navigator?.storage?.getDirectory !== 'undefined'
) {
	virtualOpfsRoot = await navigator.storage.getDirectory();
	virtualOpfsDir = await virtualOpfsRoot.getDirectoryHandle(
		startupOptions.siteSlug === 'wordpress'
			? startupOptions.siteSlug
			: 'site-' + startupOptions.siteSlug,
		{
			create: true,
		}
	);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	lastOpfsHandle = virtualOpfsDir;
	lastOpfsMountpoint = '/wordpress';
	wordPressAvailableInOPFS = await playgroundAvailableInOpfs(virtualOpfsDir!);
}

// The SQLite integration must always be downloaded, even when using OPFS or Native FS,
// because it can't be assumed to exist in WordPress document root. Instead, it's installed
// in the /internal directory to avoid polluting the mounted directory structure.
downloadMonitor.expectAssets({
	[sqliteDatabaseIntegrationModuleDetails.url]:
		sqliteDatabaseIntegrationModuleDetails.size,
});
const sqliteIntegrationRequest = downloadMonitor.monitorFetch(
	fetch(sqliteDatabaseIntegrationModuleDetails.url)
);

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
export class PlaygroundWorkerEndpoint extends PHPWorker {
	/**
	 * A string representing the scope of the Playground instance.
	 */
	scope: string;

	/**
	 * A string representing the requested version of WordPress.
	 */
	requestedWordPressVersion: string;

	/**
	 * A string representing the version of WordPress that was loaded.
	 */
	loadedWordPressVersion: string | undefined;

	constructor(
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		requestedWordPressVersion: string
	) {
		super(undefined, monitor);
		this.scope = scope;
		this.requestedWordPressVersion = requestedWordPressVersion;
	}

	/**
	 * @returns WordPress module details, including the static assets directory and default theme.
	 */
	async getWordPressModuleDetails() {
		return {
			majorVersion:
				this.loadedWordPressVersion || this.requestedWordPressVersion,
			staticAssetsDirectory: this.loadedWordPressVersion
				? wpVersionToStaticAssetsDirectory(this.loadedWordPressVersion)
				: undefined,
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
		await this.bindOpfs({
			opfs: lastOpfsHandle!,
			mountpoint: lastOpfsMountpoint!,
		});
	}

	async bindOpfs(
		options: Omit<BindOpfsOptions, 'php' | 'onProgress'>,
		onProgress?: SyncProgressCallback
	) {
		lastOpfsHandle = options.opfs;
		lastOpfsMountpoint = options.mountpoint;
		await bindOpfs({
			php: this.__internal_getPHP()!,
			onProgress,
			...options,
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

	async backfillStaticFilesRemovedFromMinifiedBuild() {
		await backfillStaticFilesRemovedFromMinifiedBuild(
			this.__internal_getPHP()!
		);
	}
}

/**
 * Downloads and unzips a ZIP bundle of all the static assets removed from
 * the currently loaded minified WordPress build. Doesn't do anything if the
 * assets are already downloaded or if a non-minified WordPress build is loaded.
 *
 * ## Asset Loading
 *
 * To load Playground faster, we default to minified WordPress builds shipped
 * without most CSS files, JS files, and other static assets.
 *
 * When Playground requests a static asset that is not in the minified build, the service
 * worker consults the list of the assets removed during the minification process. Such
 * a list is shipped with every minified build in a file called `wordpress-remote-asset-paths`.
 *
 * For example, when `/wp-includes/css/dist/block-library/common.min.css` isn't found
 * in the Playground filesystem, the service worker looks for it in `/wordpress/wordpress-remote-asset-paths`
 * and finds it there. This means it's available on the remote server, so the service
 * worker fetches it from an URL like:
 *
 * https://playground.wordpress.net/wp-6.5/wp-includes/css/dist/block-library/common.min.css
 *
 * ## Assets backfilling
 *
 * Running Playground offline isn't possible without shipping all the static assets into the browser.
 * Downloading every CSS and JS file one request at a time would be slow to run and tedious to maintain.
 * This is where this function comes in!
 *
 * It downloads a zip archive containing all the static files removed from the currently running
 * minified build, and unzips them in the Playground filesystem. Once it finishes, the WordPress
 * installation running in the browser is complete and the service worker will no longer have
 * to backfill any static assets again.
 *
 * This process is started after the Playground boots (see `bootPlaygroundRemote`) and the first
 * page is rendered. This way we're not delaying the initial Playground paint with a large download.
 *
 * ## Prevent backfilling if assets are already available
 *
 * Running this function twice, or running it on a non-minified build will have no effect.
 *
 * The backfilling only runs when a non-empty `wordpress-remote-asset-paths` file
 * exists. When one is missing, we're not running a minified build. When one is empty,
 * it means the backfilling process was already done – this function empties the file
 * after the backfilling is done.
 *
 * ### Downloading assets during backfill
 *
 * Each WordPress release has a corresponding static assets directory on the Playground.WordPress.net server.
 * The file is downloaded from the server and unzipped into the WordPress document root.
 *
 * ### Skipping existing files during unzipping
 *
 * If any of the files already exist, they are skipped and not overwritten.
 * By skipping existing files, we ensure that the backfill process doesn't overwrite any user changes.
 */
async function backfillStaticFilesRemovedFromMinifiedBuild(php: PHP) {
	if (!php.requestHandler) {
		logger.warn('No PHP request handler available');
		return;
	}

	try {
		const remoteAssetListPath = joinPaths(
			php.requestHandler.documentRoot,
			'wordpress-remote-asset-paths'
		);

		if (
			!php.fileExists(remoteAssetListPath) ||
			(await php.readFileAsText(remoteAssetListPath)) === ''
		) {
			return;
		}
		const wpVersion = await getLoadedWordPressVersion(php.requestHandler);
		const staticAssetsDirectory =
			wpVersionToStaticAssetsDirectory(wpVersion);
		if (!staticAssetsDirectory) {
			return;
		}
		const response = await fetch(
			joinPaths('/', staticAssetsDirectory, 'wordpress-static.zip')
		);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch WordPress static assets: ${response.status} ${response.statusText}`
			);
		}

		await unzipFile(
			php,
			new File([await response.blob()], 'wordpress-static.zip'),
			php.requestHandler.documentRoot,
			false
		);
		// Clear the remote asset list to indicate that the assets are downloaded.
		await php.writeFile(remoteAssetListPath, '');
	} catch (e) {
		logger.warn('Failed to download WordPress assets', e);
	}
}

const apiEndpoint = new PlaygroundWorkerEndpoint(
	downloadMonitor,
	scope,
	startupOptions.wpVersion
);
const [setApiReady, setAPIError] = exposeAPI(apiEndpoint);

try {
	const constants: Record<string, any> = wordPressAvailableInOPFS
		? {}
		: {
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
		  };
	const wordPressZip = wordPressAvailableInOPFS
		? undefined
		: new File([await (await wordPressRequest!).blob()], 'wp.zip');

	const sqliteIntegrationPluginZip = new File(
		[await (await sqliteIntegrationRequest).blob()],
		'sqlite.zip'
	);

	const requestHandler = await bootWordPress({
		siteUrl: setURLScope(wordPressSiteUrl, scope).toString(),
		createPhpRuntime,
		wordPressZip,
		sqliteIntegrationPluginZip,
		spawnHandler: spawnHandlerFactory,
		sapiName: startupOptions.sapiName,
		constants,
		hooks: {
			async beforeDatabaseSetup(php) {
				if (virtualOpfsDir) {
					await bindOpfs({
						php,
						mountpoint: '/wordpress',
						opfs: virtualOpfsDir!,
						initialSyncDirection: wordPressAvailableInOPFS
							? 'opfs-to-memfs'
							: 'memfs-to-opfs',
					});
				}
			},
		},
		createFiles: {
			'/internal/shared/mu-plugins': {
				'1-playground-web.php': playgroundWebMuPlugin,
				'playground-includes': {
					'wp_http_dummy.php': transportDummy,
					'wp_http_fetch.php': transportFetch,
				},
			},
		},
	});
	apiEndpoint.__internal_setRequestHandler(requestHandler);

	const primaryPhp = await requestHandler.getPrimaryPhp();
	await apiEndpoint.setPrimaryPHP(primaryPhp);

	// NOTE: We need to derive the loaded WP version or we might assume WP loaded
	// from browser storage is the default version when it is actually something else.
	// Incorrectly assuming WP version can break things like remote asset retrieval
	// for minified WP builds.
	apiEndpoint.loadedWordPressVersion = await getLoadedWordPressVersion(
		requestHandler
	);
	if (
		apiEndpoint.requestedWordPressVersion !==
		apiEndpoint.loadedWordPressVersion
	) {
		logger.warn(
			`Loaded WordPress version (${apiEndpoint.loadedWordPressVersion}) differs ` +
				`from requested version (${apiEndpoint.requestedWordPressVersion}).`
		);
	}

	const wpStaticAssetsDir = wpVersionToStaticAssetsDirectory(
		apiEndpoint.loadedWordPressVersion
	);
	const remoteAssetListPath = joinPaths(
		requestHandler.documentRoot,
		'wordpress-remote-asset-paths'
	);
	if (
		wpStaticAssetsDir !== undefined &&
		!primaryPhp.fileExists(remoteAssetListPath)
	) {
		// The loaded WP release has a remote static assets dir
		// but no remote asset listing, so we need to backfill the listing.
		const listUrl = new URL(
			joinPaths(wpStaticAssetsDir, 'wordpress-remote-asset-paths'),
			wordPressSiteUrl
		);
		try {
			const remoteAssetPaths = await fetch(listUrl).then((res) =>
				res.text()
			);
			primaryPhp.writeFile(remoteAssetListPath, remoteAssetPaths);
		} catch (e) {
			logger.warn(`Failed to fetch remote asset paths from ${listUrl}`);
		}
	}

	setApiReady();
} catch (e) {
	setAPIError(e as Error);
	throw e;
}
