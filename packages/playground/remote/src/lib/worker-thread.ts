import type { FilesystemOperation } from '@php-wasm/fs-journal';
import { journalFSEvents, replayFSJournal } from '@php-wasm/fs-journal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { joinPaths, randomString } from '@php-wasm/util';
import type {
	GeneratedCertificate,
	MountDevice,
	SyncProgressCallback,
	TCPOverFetchOptions,
} from '@php-wasm/web';
import {
	createDirectoryHandleMountHandler,
	exposeAPI,
	loadWebRuntime,
} from '@php-wasm/web';
import {
	createMemoizedFetch,
	RecommendedPHPVersion,
} from '@wp-playground/common';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import {
	getSqliteDriverModuleDetails,
	getWordPressModuleDetails,
	LatestMinifiedWordPressVersion,
	LatestSqliteDriverVersion,
	MinifiedWordPressVersions,
	MinifiedWordPressVersionsList,
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
import type {
	MessageListener,
	PHP,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHPResponse,
	PHPWorker,
	sandboxedSpawnHandlerFactory,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import { certificateToPEM, generateCertificate } from '@php-wasm/web';
import type {
	BlueprintDeclaration,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import { runBlueprintV2 } from '@wp-playground/blueprints';
import {
	bootJustWordPress,
	bootRequestHandler,
	getFileNotFoundActionForWordPress,
	getLoadedWordPressVersion,
} from '@wp-playground/wordpress';
import { wpVersionToStaticAssetsDirectory } from '@wp-playground/wordpress-builds';
import {
	intlDisabledFunctions,
	networkingDisabledFunctions,
} from './disabled-functions';
/* @ts-ignore */
import playgroundWebMuPlugin from './playground-mu-plugin/0-playground.php?raw';
import { WordPressFetchNetworkTransport } from './wordpress-fetch-network-transport';
/* @ts-ignore */
import { corsProxyUrl as defaultCorsProxyUrl } from 'virtual:cors-proxy-url';

// post message to parent
self.postMessage('worker-script-started');

const downloadMonitor = new EmscriptenDownloadMonitor();

const monitoredFetch = (input: RequestInfo | URL, init?: RequestInit) =>
	downloadMonitor.monitorFetch(fetch(input, init));
const memoizedFetch = createMemoizedFetch(monitoredFetch);

class ArtifactExpiredError extends Error {
	constructor(message = 'GitHub artifact expired') {
		super(message);
		this.name = 'ArtifactExpiredError';
	}
}

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
	withICU: boolean;
	withNetworking: boolean;
	mounts?: Array<MountDescriptor>;
	shouldInstallWordPress?: boolean;
	corsProxyUrl?: string;
	/** When true, skip default WP install and run Blueprints v2 in the worker */
	experimentalBlueprintsV2Runner?: boolean;
	/** Blueprint v2 declaration to run in the worker when experimental mode is on */
	blueprint?: BlueprintDeclaration;
};

/** @inheritDoc PHPClient */
export class PlaygroundWorkerEndpoint extends PHPWorker {
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

	onMessageListeners: MessageListener[] = [];
	blueprintMessageListeners: Array<(message: any) => void | Promise<void>> =
		[];

	unmounts: Record<string, () => any> = {};

	private networkTransport: WordPressFetchNetworkTransport | undefined;

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(undefined, monitor);
	}

	private computeSiteUrl(scope: string) {
		return setURLScope(wordPressSiteUrl, scope).toString();
	}

	// Split boot implementation: Blueprint v1 (default WordPress install path)
	async bootBlueprintV1({
		scope,
		mounts = [],
		wpVersion = LatestMinifiedWordPressVersion,
		sqliteDriverVersion = LatestSqliteDriverVersion,
		phpVersion = RecommendedPHPVersion,
		sapiName = 'cli',
		withICU = false,
		withNetworking = true,
		shouldInstallWordPress = true,
		corsProxyUrl,
	}: WorkerBootOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}

		if (corsProxyUrl === undefined) {
			corsProxyUrl = defaultCorsProxyUrl;
		}

		this.booted = true;
		this.scope = scope;
		if (!SupportedPHPVersionsList.includes(phpVersion)) {
			throw new Error(
				`Unsupported PHP version: ${phpVersion}. Supported versions: ${SupportedPHPVersionsList.join(
					', '
				)}`
			);
		}

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		try {
			const endpoint = this;
			const knownRemoteAssetPaths = new Set<string>();
			const siteUrl = this.computeSiteUrl(scope);
			const requestHandler = await this.createRequestHandler({
				siteUrl,
				sapiName,
				withICU,
				corsProxyUrl,
				knownRemoteAssetPaths,
				withNetworking,
				phpVersion,
			});

			this.requestedWordPressVersion = wpVersion;
			wpVersion = MinifiedWordPressVersionsList.includes(wpVersion)
				? wpVersion
				: LatestMinifiedWordPressVersion;

			let wordPressRequest: Promise<Response> | null = null;
			if (shouldInstallWordPress) {
				if (this.requestedWordPressVersion!.startsWith('http')) {
					wordPressRequest = monitoredFetch(
						this.requestedWordPressVersion as string
					).then((response) => {
						if (response.ok) {
							return response;
						}
						let json: any = null;
						return response.json().then(
							(parsedJson) => {
								json = parsedJson;
								if (json && json.error === 'artifact_expired') {
									throw new ArtifactExpiredError();
								}
								throw new Error(
									`Failed to download WordPress ZIP (HTTP ${response.status})`
								);
							},
							() => {
								throw new Error(
									`Failed to download WordPress ZIP (HTTP ${response.status})`
								);
							}
						);
					});
				} else {
					const wpDetails = getWordPressModuleDetails(wpVersion);
					downloadMonitor.expectAssets({
						[wpDetails.url]: wpDetails.size,
					});
					wordPressRequest = monitoredFetch(wpDetails.url);
				}
			}

			let sqliteIntegrationRequest: Promise<Response> | null = null;
			const sqliteDriverModuleDetails = getSqliteDriverModuleDetails(
				sqliteDriverVersion!
			);
			downloadMonitor.expectAssets({
				[sqliteDriverModuleDetails.url]: sqliteDriverModuleDetails.size,
			});
			sqliteIntegrationRequest = downloadMonitor.monitorFetch(
				fetch(sqliteDriverModuleDetails.url)
			);

			await bootJustWordPress(requestHandler, {
				siteUrl,
				constants: shouldInstallWordPress
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
					: {},
				wordPressZip: shouldInstallWordPress
					? wordPressRequest!
							.then((r) => r.blob())
							.then((b) => new File([b], 'wp.zip'))
					: undefined,
				sqliteIntegrationPluginZip: sqliteIntegrationRequest
					? sqliteIntegrationRequest
							.then((r) => r.blob())
							.then((b) => new File([b], 'sqlite.zip'))
					: undefined,
				hooks: {
					async beforeWordPressFiles(php: PHP) {
						for (const mount of mounts) {
							const handle = await directoryHandleFromMountDevice(
								mount.device
							);
							const unmount = await php.mount(
								mount.mountpoint,
								createDirectoryHandleMountHandler(handle, {
									initialSync: {
										direction: mount.initialSyncDirection,
									},
								})
							);
							endpoint.unmounts[mount.mountpoint] = unmount;
						}
					},
				},
			});

			await this.finalizeAfterBoot(
				requestHandler,
				withNetworking,
				knownRemoteAssetPaths
			);
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	private async createRequestHandler({
		siteUrl,
		sapiName,
		withICU,
		corsProxyUrl,
		knownRemoteAssetPaths,
		withNetworking,
		phpVersion,
	}: {
		siteUrl: string;
		sapiName: string;
		withICU: boolean;
		corsProxyUrl?: string;
		knownRemoteAssetPaths: Set<string>;
		withNetworking: boolean;
		phpVersion: SupportedPHPVersion;
	}) {
		const phpIniEntries: Record<string, string> = {
			'openssl.cafile': '/internal/shared/ca-bundle.crt',
		};
		if (!withICU) {
			phpIniEntries['disable_functions'] = (
				phpIniEntries['disable_functions'] ?? ''
			)
				.split(',')
				.concat(intlDisabledFunctions)
				.filter((n) => n)
				.join(',');
		}

		let tcpOverFetch: TCPOverFetchOptions | undefined = undefined;
		let caBundleContent = '';
		if (withNetworking) {
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

		const requestHandler = await bootRequestHandler({
			siteUrl,
			createPhpRuntime: async () => {
				let wasmUrl = '';
				return await loadWebRuntime(phpVersion, {
					withICU,
					tcpOverFetch,
					onPhpLoaderModuleLoaded: (phpLoaderModule) => {
						wasmUrl = phpLoaderModule.dependencyFilename;
						downloadMonitor.expectAssets({
							[wasmUrl]: phpLoaderModule.dependenciesTotalSize,
						});
					},
					emscriptenOptions: {
						instantiateWasm(imports, receiveInstance) {
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
									receiveInstance(wasm.instance, wasm.module);
								});
							return {};
						},
					},
				});
			},
			onPHPInstanceCreated: async (php: PHP) => {
				if (withNetworking) {
					await this.networkTransport!.setupMessageHandler(php);
				}
				php.onMessage(async (message) => {
					for (const listener of this.onMessageListeners) {
						const returnData = await listener(message);
						if (returnData) {
							return returnData;
						}
					}
					return '';
				});
			},
			spawnHandler: sandboxedSpawnHandlerFactory,
			sapiName,
			phpIniEntries,
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
				if (!knownRemoteAssetPaths.has(relativeUri)) {
					return getFileNotFoundActionForWordPress(relativeUri);
				}
				return {
					type: 'response',
					response: new PHPResponse(
						404,
						{
							'x-backfill-from': ['remote-host'],
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

	private async finalizeAfterBoot(
		requestHandler: any,
		withNetworking: boolean,
		knownRemoteAssetPaths: Set<string>
	) {
		const primaryPhp = await requestHandler.getPrimaryPhp();

		if (withNetworking) {
			await this.networkTransport!.setEnabled(primaryPhp, true);
		}

		this.loadedWordPressVersion = await getLoadedWordPressVersion(
			requestHandler
		);
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
		setApiReady();
	}

	// Split boot implementation: Blueprint v2 runner (no default install)
	async bootBlueprintV2({
		scope,
		mounts = [],
		wpVersion = LatestMinifiedWordPressVersion,
		phpVersion = RecommendedPHPVersion,
		sapiName = 'cli',
		withICU = false,
		withNetworking = true,
		corsProxyUrl,
		blueprint,
	}: WorkerBootOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}

		if (corsProxyUrl === undefined) {
			corsProxyUrl = defaultCorsProxyUrl;
		}

		this.booted = true;
		this.scope = scope;
		this.requestedWordPressVersion = wpVersion;

		wpVersion = MinifiedWordPressVersionsList.includes(wpVersion)
			? wpVersion
			: LatestMinifiedWordPressVersion;

		if (!SupportedPHPVersionsList.includes(phpVersion)) {
			throw new Error(
				`Unsupported PHP version: ${phpVersion}. Supported versions: ${SupportedPHPVersionsList.join(
					', '
				)}`
			);
		}

		try {
			const knownRemoteAssetPaths = new Set<string>();
			const siteUrl = this.computeSiteUrl(scope);
			const requestHandler = await this.createRequestHandler({
				siteUrl,
				sapiName,
				withICU,
				corsProxyUrl,
				knownRemoteAssetPaths,
				withNetworking,
				phpVersion,
			});
			const primaryPhp = await requestHandler.getPrimaryPhp();

			if (!blueprint) {
				throw new Error(
					'Blueprints v2 runner requires a blueprint declaration.'
				);
			}
			const streamed = await runBlueprintV2({
				php: primaryPhp,
				cliArgs: ['--site-url=' + siteUrl],
				blueprint: blueprint as BlueprintV2Declaration,
				onMessage: async (message: any) => {
					for (const listener of this.blueprintMessageListeners) {
						await listener(message);
					}
				},
			});
			await streamed.finished;

			await this.finalizeAfterBoot(
				requestHandler,
				withNetworking,
				knownRemoteAssetPaths
			);
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
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

	override onMessage(listener: MessageListener) {
		this.onMessageListeners.push(listener);
		return async () => {
			this.onMessageListeners = this.onMessageListeners.filter(
				(l) => l !== listener
			);
		};
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

	async boot({
		scope,
		mounts = [],
		wpVersion = LatestMinifiedWordPressVersion,
		sqliteDriverVersion = LatestSqliteDriverVersion,
		phpVersion = RecommendedPHPVersion,
		sapiName = 'cli',
		withICU = false,
		withNetworking = true,
		shouldInstallWordPress = true,
		corsProxyUrl,
		experimentalBlueprintsV2Runner = false,
		blueprint,
	}: WorkerBootOptions) {
		// Delegate to version-specific boot methods
		if (experimentalBlueprintsV2Runner) {
			return await this.bootBlueprintV2({
				scope,
				mounts,
				wpVersion,
				phpVersion,
				sapiName,
				withICU,
				withNetworking,
				corsProxyUrl,
				blueprint,
				experimentalBlueprintsV2Runner,
			});
		}
		return await this.bootBlueprintV1({
			scope,
			mounts,
			wpVersion,
			sqliteDriverVersion,
			phpVersion,
			sapiName,
			withICU,
			withNetworking,
			shouldInstallWordPress,
			corsProxyUrl,
		});
	}

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

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpoint(downloadMonitor)
);
