import type { FilesystemOperation } from '@php-wasm/fs-journal';
import { journalFSEvents, replayFSJournal } from '@php-wasm/fs-journal';
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { joinPaths } from '@php-wasm/util';
import type { SyncProgressCallback, TCPOverFetchOptions } from '@php-wasm/web';
import type { MountDevice } from '@wp-playground/storage';
import {
	createDirectoryHandleMountHandler,
	loadWebRuntime,
} from '@php-wasm/web';
import { createMemoizedFetch } from '@wp-playground/common';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import {
	LatestMinifiedWordPressVersion,
	MinifiedWordPressVersions,
} from '@wp-playground/wordpress-builds';
import { wordPressSiteUrl } from './config';
import {
	backfillStaticFilesRemovedFromMinifiedBuild,
	hasCachedStaticFilesRemovedFromMinifiedBuild,
} from './worker-utils';
/* @ts-ignore */
import transportFetch from './playground-mu-plugin/playground-includes/wp_http_fetch.php?raw';
/* @ts-ignore */
import transportDummy from './playground-mu-plugin/playground-includes/wp_http_dummy.php?raw';
import { logger } from '@php-wasm/logger';
import type { PathAlias, PHP, SupportedPHPVersion } from '@php-wasm/universal';
import {
	PHPResponse,
	PHPWorker,
	isPathToSharedFS,
	proxyFileSystem,
	sandboxedSpawnHandlerFactory,
} from '@php-wasm/universal';
import { certificateToPEM, generateCertificate } from '@php-wasm/web';
import type { BlueprintDeclaration } from '@wp-playground/blueprints';
import type { WordPressInstallMode } from '@wp-playground/wordpress';
import {
	bootRequestHandler,
	getFileNotFoundActionForWordPress,
	getLoadedWordPressVersion,
} from '@wp-playground/wordpress';
import { wpVersionToStaticAssetsDirectory } from '@wp-playground/wordpress-builds';
import { networkingDisabledFunctions } from './disabled-functions';
/* @ts-ignore */
import playgroundWebMuPlugin from './playground-mu-plugin/0-playground.php?raw';
import { WordPressFetchNetworkTransport } from './wordpress-fetch-network-transport';

export interface MountDescriptor {
	mountpoint: string;
	device: MountDevice;
	initialSyncDirection: 'opfs-to-memfs' | 'memfs-to-opfs';
}

export type WorkerBootOptions = {
	wpVersion?: string;
	sqliteDriverVersion?: string;
	phpVersion?: SupportedPHPVersion;
	sapiName?: string;
	scope: string;
	withIntl: boolean;
	withNetworking: boolean;
	mounts?: Array<MountDescriptor>;
	shouldInstallWordPress?: boolean;
	corsProxyUrl?: string;
	/** When true, skip default WP install and run Blueprints v2 in the worker */
	experimentalBlueprintsV2Runner?: boolean;
	/** Blueprint v2 declaration to run in the worker when experimental mode is on */
	blueprint?: BlueprintDeclaration;
	/**
	 * How to handle WordPress installation.
	 * Defaults to 'install-from-existing-files-if-needed'.
	 */
	wordpressInstallMode?: WordPressInstallMode;
	/**
	 * Path aliases that map URL prefixes to filesystem paths outside
	 * the document root. Similar to Nginx's `alias` directive.
	 */
	pathAliases?: PathAlias[];
};

/** @inheritDoc PHPClient */
export abstract class PlaygroundWorkerEndpoint extends PHPWorker {
	booted = false;

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

	blueprintMessageListeners: Array<(message: any) => void | Promise<void>> =
		[];

	unmounts: Record<string, () => any> = {};

	private networkTransport: WordPressFetchNetworkTransport | undefined;

	protected downloadMonitor: EmscriptenDownloadMonitor;
	protected memoizedFetch: ReturnType<typeof createMemoizedFetch>;

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(undefined, monitor);

		this.downloadMonitor = monitor;
		const monitoredFetch = (input: RequestInfo | URL, init?: RequestInit) =>
			this.downloadMonitor.monitorFetch(fetch(input, init));
		this.memoizedFetch = createMemoizedFetch(monitoredFetch);
	}

	protected computeSiteUrl(scope: string) {
		return setURLScope(wordPressSiteUrl, scope).toString();
	}

	// NOTE: Version-specific boot methods are implemented in the concrete worker entrypoints

	protected async createRequestHandler({
		siteUrl,
		sapiName,
		corsProxyUrl,
		knownRemoteAssetPaths,
		withIntl,
		withNetworking,
		phpVersion,
		pathAliases,
	}: {
		siteUrl: string;
		sapiName: string;
		corsProxyUrl?: string;
		knownRemoteAssetPaths: Set<string>;
		withIntl: boolean;
		withNetworking: boolean;
		phpVersion: SupportedPHPVersion;
		pathAliases?: PathAlias[];
	}) {
		const phpIniEntries: Record<string, string> = {
			'openssl.cafile': '/internal/shared/ca-bundle.crt',
		};

		let tcpOverFetch: TCPOverFetchOptions | undefined = undefined;
		let caBundleContent = '';
		if (withNetworking) {
			// @TODO: Is it fine this is only set in this code branch? That
			//        makes sense and all, but the previous worker always created the transport.
			this.networkTransport = new WordPressFetchNetworkTransport({
				corsProxyUrl,
			});
			const CAroot = await generateCertificate({
				subject: {
					commonName: 'WordPressPlaygroundCA',
					organizationName: 'WordPressPlaygroundCA',
					countryName: 'US',
				},
				basicConstraints: {
					ca: true,
				},
			});
			caBundleContent = certificateToPEM(CAroot.certificate);
			tcpOverFetch = {
				CAroot,
				corsProxyUrl,
			};
			phpIniEntries['disable_functions'] = (
				phpIniEntries['disable_functions'] ?? ''
			)
				.split(',')
				.concat(['curl_share_init'])
				.filter((n) => n)
				.join(',');
		} else {
			phpIniEntries['allow_url_fopen'] = '0';
			phpIniEntries['disable_functions'] = (
				phpIniEntries['disable_functions'] ?? ''
			)
				.split(',')
				.concat(networkingDisabledFunctions)
				.filter((n) => n)
				.join(',');
		}

		const parsedSiteUrl = new URL(siteUrl);
		const requestHandler = await bootRequestHandler({
			siteUrl,
			createPhpRuntime: async () => {
				let wasmUrl = '';
				return await loadWebRuntime(phpVersion, {
					withIntl,
					tcpOverFetch,
					onPhpLoaderModuleLoaded: (phpLoaderModule) => {
						wasmUrl = phpLoaderModule.dependencyFilename;
						this.downloadMonitor.expectAssets({
							[wasmUrl]: phpLoaderModule.dependenciesTotalSize,
						});
					},
					emscriptenOptions: {
						instantiateWasm: async (
							imports: any,
							receiveInstance: any
						) => {
							const response = await this.memoizedFetch(wasmUrl, {
								credentials: 'same-origin',
							});
							const wasm = await WebAssembly.instantiateStreaming(
								response as Response,
								imports
							);
							receiveInstance(wasm.instance, wasm.module);
							return {} as any;
						},
					},
				});
			},
			onPHPInstanceCreated: async (php: PHP, { isPrimary }) => {
				if (!isPrimary) {
					const pathsToShareBetweenPhpInstances = [
						'/tmp',
						requestHandler.documentRoot,
						'/internal/shared',
						'/internal/symlinks',
					];
					const pathsToProxy = pathsToShareBetweenPhpInstances.filter(
						(path) => !isPathToSharedFS(php, path)
					);

					// TODO: Document that this shift is a breaking change.
					// Proxy the filesystem for all secondary PHP instances to
					// the primary one.
					proxyFileSystem(
						await requestHandler.getPrimaryPhp(),
						php,
						pathsToProxy
					);
				}
				if (withNetworking) {
					await this.networkTransport!.setupMessageHandler(php);
				}
			},
			spawnHandler: sandboxedSpawnHandlerFactory,
			sapiName,
			phpIniEntries,
			pathAliases,
			createFiles: {
				'/internal/shared/ca-bundle.crt': caBundleContent,
				'/internal/shared/mu-plugins': {
					'1-playground-web.php': playgroundWebMuPlugin,
					'playground-includes': {
						'wp_http_dummy.php': transportDummy,
						'wp_http_fetch.php': transportFetch,
					},
				},
			},
			getFileNotFoundAction(relativeUri: string) {
				/**
				 * Known remote asset paths are stored as site-relative paths. We
				 * need to remove the site root path prefix (e.g. scope:my-site) from
				 * the request URL's pathname.
				 */
				const siteRelativePath =
					parsedSiteUrl.pathname.length > 0 &&
					relativeUri.startsWith(parsedSiteUrl.pathname)
						? relativeUri.substring(parsedSiteUrl.pathname.length)
						: relativeUri;
				if (!knownRemoteAssetPaths.has(siteRelativePath)) {
					return getFileNotFoundActionForWordPress(siteRelativePath);
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

		const primaryPhp = await requestHandler.getPrimaryPhp();
		await this.setPrimaryPHP(primaryPhp);
		return requestHandler;
	}

	protected async finalizeAfterBoot(
		requestHandler: any,
		withNetworking: boolean,
		knownRemoteAssetPaths: Set<string>
	) {
		const primaryPhp = await requestHandler.getPrimaryPhp();

		if (withNetworking) {
			/**
			 * Only setup the network transport after WordPress have been installed. Otherwise,
			 * the installer may send a network request to /wp-cron.php, which will fail because
			 * the entire setup around network, SQLite, etc. is not complete yet.
			 */
			await this.networkTransport!.setEnabled(primaryPhp, true);
		}

		// NOTE: We need to derive the loaded WP version or we might assume WP loaded
		// from browser storage is the default version when it is actually something else.
		// Assuming an incorrect WP version would break remote asset retrieval for minified
		// WP builds – we would download the wrong assets pack.
		this.loadedWordPressVersion =
			await getLoadedWordPressVersion(requestHandler);
		if (this.requestedWordPressVersion !== this.loadedWordPressVersion) {
			logger.warn(
				`Loaded WordPress version (${this.loadedWordPressVersion}) differs ` +
					`from requested version (${this.requestedWordPressVersion}).`
			);
		}

		const wpStaticAssetsDir = wpVersionToStaticAssetsDirectory(
			this.loadedWordPressVersion
		);
		const remoteAssetListPath = joinPaths(
			requestHandler.documentRoot,
			'wordpress-remote-asset-paths'
		);
		if (
			wpStaticAssetsDir !== undefined &&
			!primaryPhp.fileExists(remoteAssetListPath)
		) {
			const listUrl = new URL(
				joinPaths(wpStaticAssetsDir, 'wordpress-remote-asset-paths'),
				wordPressSiteUrl
			);
			try {
				const remoteAssetPaths = await fetch(listUrl).then((res) =>
					res.text()
				);
				primaryPhp.writeFile(remoteAssetListPath, remoteAssetPaths);
			} catch {
				logger.warn(
					`Failed to fetch remote asset paths from ${listUrl}`
				);
			}
		}

		if (primaryPhp.isFile(remoteAssetListPath)) {
			const remoteAssetPaths = primaryPhp
				.readFileAsText(remoteAssetListPath)
				.split('\n');
			remoteAssetPaths.forEach((wpRelativePath: string) =>
				knownRemoteAssetPaths.add(joinPaths('/', wpRelativePath))
			);
		}

		this.__internal_setRequestHandler(requestHandler);
	}

	// NOTE: Version-specific boot methods are implemented in the concrete worker entrypoints

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

	async getMinifiedWordPressVersions() {
		return {
			all: MinifiedWordPressVersions,
			latest: LatestMinifiedWordPressVersion,
		};
	}

	async hasOpfsMount(mountpoint: string) {
		return mountpoint in this.unmounts;
	}

	async mountOpfs(
		options: MountDescriptor,
		onProgress?: SyncProgressCallback
	) {
		const handle = await directoryHandleFromMountDevice(options.device);
		const php = this.__internal_getPHP()!;
		this.unmounts[options.mountpoint] = await php.mount(
			options.mountpoint,
			createDirectoryHandleMountHandler(handle, {
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

	// @TODO: Recycle addEventListener/removeEventListener instead of introducing another
	// way of listening for events.
	async onBlueprintMessage(listener: (message: any) => void | Promise<void>) {
		this.blueprintMessageListeners.push(listener);
		return async () => {
			this.blueprintMessageListeners =
				this.blueprintMessageListeners.filter((l) => l !== listener);
		};
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	abstract boot(_: any): Promise<void>;

	/**
	 * Pre-fetch the slow initial burst of wp_update_* requests to greatly
	 * improve the first wp-admin load time.
	 */
	async prefetchUpdateChecks() {
		const primaryPhp = this.__internal_getPHP()!;
		await this.networkTransport!.prefetchUpdateChecks(primaryPhp);
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
