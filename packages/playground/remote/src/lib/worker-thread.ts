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
} from './worker-utils';
import {
	FilesystemOperation,
	journalFSEvents,
	replayFSJournal,
} from '@php-wasm/fs-journal';
/** @ts-ignore */
import transportFetch from './playground-mu-plugin/playground-includes/wp_http_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './playground-mu-plugin/playground-includes/wp_http_dummy.php?raw';
/** @ts-ignore */
import playgroundWebMuPlugin from './playground-mu-plugin/0-playground.php?raw';
import { PHP, PHPWorker } from '@php-wasm/universal';
import {
	bootWordPress,
	getLoadedWordPressVersion,
} from '@wp-playground/wordpress';
import { wpVersionToStaticAssetsDirectory } from '@wp-playground/wordpress-builds';
import { logger } from '@php-wasm/logger';
import { unzipFile } from '@wp-playground/common';

const scope = Math.random().toFixed(16);

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

		/**
		 * Don't download static assets if they're already downloaded.
		 * WordPress may be loaded either from a production release or a minified bundle.
		 * Minified bundles are shipped without most CSS files, JS files, and other static assets.
		 * Instead, they contain a list of remote assets in wordpress-remote-asset-paths.
		 * We use this list to determine if we should fetch them on demand or if they are already downloaded.
		 * If the list is empty, we assume the assets are already downloaded.
		 * See https://github.com/WordPress/wordpress-playground/pull/1531
		 */
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
			php.requestHandler.documentRoot
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
