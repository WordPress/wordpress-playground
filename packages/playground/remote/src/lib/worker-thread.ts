import {
	SyncProgressCallback,
	createDirectoryHandleMountHandler,
	exposeAPI,
	loadWebRuntime,
} from '@php-wasm/web';
import { setURLScope } from '@php-wasm/scopes';
import { joinPaths } from '@php-wasm/util';
import { wordPressSiteUrl } from './config';
import {
	getWordPressModuleDetails,
	LatestSupportedWordPressVersion,
	SupportedWordPressVersions,
	sqliteDatabaseIntegrationModuleDetails,
	SupportedWordPressVersionsList,
} from '@wp-playground/wordpress-builds';
import { randomString } from '@php-wasm/util';
import {
	spawnHandlerFactory,
	backfillStaticFilesRemovedFromMinifiedBuild,
	hasCachedStaticFilesRemovedFromMinifiedBuild,
} from './worker-utils';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { createMemoizedFetch } from './create-memoized-fetch';
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
import {
	PHPResponse,
	PHPWorker,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import {
	bootWordPress,
	getFileNotFoundActionForWordPress,
	getLoadedWordPressVersion,
} from '@wp-playground/wordpress';
import { wpVersionToStaticAssetsDirectory } from '@wp-playground/wordpress-builds';
import { logger } from '@php-wasm/logger';

// post message to parent
self.postMessage('worker-script-started');

const downloadMonitor = new EmscriptenDownloadMonitor();

const monitoredFetch = (input: RequestInfo | URL, init?: RequestInit) =>
	downloadMonitor.monitorFetch(fetch(input, init));
const memoizedFetch = createMemoizedFetch(monitoredFetch);

export interface MountDescriptor {
	mountpoint: string;
	handle: FileSystemDirectoryHandle;
	initialSyncDirection: 'opfs-to-memfs' | 'memfs-to-opfs';
}

export type WorkerBootOptions = {
	wpVersion?: string;
	phpVersion?: string;
	sapiName?: string;
	phpExtensions?: string[];
	siteSlug?: string;
	scope?: string;
	withNetworking: boolean;
	mounts?: Array<MountDescriptor>;
	shouldInstallWordPress?: boolean;
};

export type ParsedBootOptions = {
	wpVersion: string;
	phpVersion: SupportedPHPVersion;
	sapiName: string;
	phpExtensions: string[];
	siteSlug: string;
	scope: string;
};

/** @inheritDoc PHPClient */
export class PlaygroundWorkerEndpoint extends PHPWorker {
	/**
	 * A string representing the scope of the Playground instance.
	 */
	scope: string | undefined;

	/**
	 * A string representing the requested version of WordPress.
	 */
	requestedWordPressVersion: string | undefined;

	/**
	 * A string representing the version of WordPress that was loaded.
	 */
	loadedWordPressVersion: string | undefined;

	unmounts: Record<string, () => any> = {};

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(undefined, monitor);
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

	async mountOpfs(
		options: MountDescriptor,
		onProgress?: SyncProgressCallback
	) {
		const php = this.__internal_getPHP()!;
		this.unmounts[options.mountpoint] = await php.mount(
			options.mountpoint,
			createDirectoryHandleMountHandler(options.handle, {
				initialSync: {
					onProgress,
					direction: options.initialSyncDirection,
				},
			})
		);
	}

	async unmountOpfs(mountpoint: string) {
		this.unmounts[mountpoint]();
		delete this.unmounts[mountpoint];
	}

	async backfillStaticFilesRemovedFromMinifiedBuild() {
		await backfillStaticFilesRemovedFromMinifiedBuild(
			this.__internal_getPHP()!
		);
	}

	async hasCachedStaticFilesRemovedFromMinifiedBuild() {
		return await hasCachedStaticFilesRemovedFromMinifiedBuild(
			this.__internal_getPHP()!
		);
	}

	async boot(options: WorkerBootOptions) {
		const requestedWPVersion = options.wpVersion || '';
		const startupOptions = {
			wpVersion: SupportedWordPressVersionsList.includes(
				requestedWPVersion
			)
				? requestedWPVersion
				: LatestSupportedWordPressVersion,
			phpVersion: SupportedPHPVersionsList.includes(
				options.phpVersion || ''
			)
				? (options.phpVersion as SupportedPHPVersion)
				: '8.0',
			sapiName: options.sapiName || 'cli',
			phpExtensions: options.phpExtensions || [],
			siteSlug: options.siteSlug,
			scope: options.scope || '',
		} as ParsedBootOptions;
		this.scope = startupOptions.scope;
		this.requestedWordPressVersion = startupOptions.wpVersion;

		try {
			// Start downloading WordPress if needed
			let wordPressRequest = null;
			if (options.shouldInstallWordPress) {
				// @TODO: Accept a WordPress ZIP file or a URL, do not
				//        reason about the `requestedWPVersion` here.
				if (requestedWPVersion.startsWith('http')) {
					// We don't know the size upfront, but we can still monitor the download.
					// monitorFetch will read the content-length response header when available.
					wordPressRequest = monitoredFetch(requestedWPVersion);
				} else {
					const wpDetails = getWordPressModuleDetails(
						startupOptions.wpVersion
					);
					downloadMonitor.expectAssets({
						[wpDetails.url]: wpDetails.size,
					});
					wordPressRequest = monitoredFetch(wpDetails.url);
				}
			}

			downloadMonitor.expectAssets({
				[sqliteDatabaseIntegrationModuleDetails.url]:
					sqliteDatabaseIntegrationModuleDetails.size,
			});
			const sqliteIntegrationRequest = downloadMonitor.monitorFetch(
				fetch(sqliteDatabaseIntegrationModuleDetails.url)
			);

			const constants: Record<string, any> =
				options.shouldInstallWordPress
					? {
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
					  }
					: {};

			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const endpoint = this;
			const knownRemoteAssetPaths = new Set<string>();
			const requestHandler = await bootWordPress({
				siteUrl: setURLScope(
					wordPressSiteUrl,
					startupOptions.scope
				).toString(),
				createPhpRuntime: async () => {
					let wasmUrl = '';
					return await loadWebRuntime(startupOptions.phpVersion, {
						onPhpLoaderModuleLoaded: (phpLoaderModule) => {
							wasmUrl = phpLoaderModule.dependencyFilename;
							downloadMonitor.expectAssets({
								[wasmUrl]:
									phpLoaderModule.dependenciesTotalSize,
							});
						},
						// We don't yet support loading specific PHP extensions one-by-one.
						// Let's just indicate whether we want to load all of them.
						loadAllExtensions:
							startupOptions.phpExtensions?.length > 0,
						emscriptenOptions: {
							instantiateWasm(imports, receiveInstance) {
								// Using .then because Emscripten typically returns an empty
								// object here and not a promise.
								memoizedFetch(wasmUrl, {
									credentials: 'same-origin',
								})
									.then((response) =>
										WebAssembly.instantiateStreaming(
											response,
											imports
										)
									)
									.then((wasm) => {
										receiveInstance(
											wasm.instance,
											wasm.module
										);
									});
								return {};
							},
						},
					});
				},
				// Do not await the WordPress download or the sqlite integration download.
				// Let bootWordPress start the PHP runtime download first, and then await
				// all the ZIP files right before they're used.
				wordPressZip: options.shouldInstallWordPress
					? wordPressRequest!
							.then((r) => r.blob())
							.then((b) => new File([b], 'wp.zip'))
					: undefined,
				sqliteIntegrationPluginZip: sqliteIntegrationRequest
					.then((r) => r.blob())
					.then((b) => new File([b], 'sqlite.zip')),
				spawnHandler: spawnHandlerFactory,
				sapiName: options.sapiName,
				constants,
				hooks: {
					async beforeWordPressFiles(php) {
						for (const mount of options.mounts || []) {
							const unmount = await php.mount(
								mount.mountpoint,
								createDirectoryHandleMountHandler(
									mount.handle,
									{
										initialSync: {
											direction:
												mount.initialSyncDirection,
										},
									}
								)
							);
							endpoint.unmounts[mount.mountpoint] = unmount;
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
				getFileNotFoundAction(relativeUri: string) {
					if (!knownRemoteAssetPaths.has(relativeUri)) {
						return getFileNotFoundActionForWordPress(relativeUri);
					}

					// This path is listed as a remote asset. Mark it as a static file
					// so the service worker knows it can issue a real fetch() to the server.
					return {
						type: 'response',
						response: new PHPResponse(
							404,
							{
								'x-backfill-from': ['remote-host'],
								// Include x-file-type header so remote asset
								// retrieval continues to work for clients
								// running a prior service worker version.
								'x-file-type': ['static'],
							},
							new TextEncoder().encode('404 File not found')
						),
					};
				},
			});
			apiEndpoint.__internal_setRequestHandler(requestHandler);

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await apiEndpoint.setPrimaryPHP(primaryPhp);

			// NOTE: We need to derive the loaded WP version or we might assume WP loaded
			// from browser storage is the default version when it is actually something else.
			// Incorrectly assuming WP version can break things like remote asset retrieval
			// for minified WP builds.
			apiEndpoint.loadedWordPressVersion =
				await getLoadedWordPressVersion(requestHandler);
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
					joinPaths(
						wpStaticAssetsDir,
						'wordpress-remote-asset-paths'
					),
					wordPressSiteUrl
				);
				try {
					const remoteAssetPaths = await fetch(listUrl).then((res) =>
						res.text()
					);
					primaryPhp.writeFile(remoteAssetListPath, remoteAssetPaths);
				} catch (e) {
					logger.warn(
						`Failed to fetch remote asset paths from ${listUrl}`
					);
				}
			}

			if (primaryPhp.isFile(remoteAssetListPath)) {
				const remoteAssetPaths = primaryPhp
					.readFileAsText(remoteAssetListPath)
					.split('\n');
				remoteAssetPaths.forEach((wpRelativePath) =>
					knownRemoteAssetPaths.add(joinPaths('/', wpRelativePath))
				);
			}

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	// These methods are only here for the time traveling Playground demo.
	// Let's consider removing them in the future.

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

const apiEndpoint = new PlaygroundWorkerEndpoint(downloadMonitor);
const [setApiReady, setAPIError] = exposeAPI(apiEndpoint);
