import { WebPHP, WebPHPEndpoint, exposeAPI } from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { wordPressSiteUrl } from './config';
import {
	getWordPressModuleDetails,
	LatestSupportedWordPressVersion,
	SupportedWordPressVersions,
	sqliteDatabaseIntegrationModuleDetails,
} from '@wp-playground/wordpress-builds';
import { bootWordPress } from '@wp-playground/wordpress';
import {
	SyncProgressCallback,
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
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string
	) {
		super(undefined, monitor);
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
		createPhpInstance() {
			return new WebPHP();
		},
		createPhpRuntime,
		wordPressZip,
		sqliteIntegrationPluginZip,
		spawnHandler: spawnHandlerFactory,
		sapiName: startupOptions.sapiName,
		constants,
		hooks: {
			async beforeDatabase(php) {
				if (virtualOpfsDir) {
					await bindOpfs({
						php,
						opfs: virtualOpfsDir!,
						wordPressAvailableInOPFS,
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

	setApiReady();
} catch (e) {
	setAPIError(e as Error);
	throw e;
}
