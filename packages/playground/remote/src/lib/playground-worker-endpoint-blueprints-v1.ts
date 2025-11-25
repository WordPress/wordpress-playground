import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import { PlaygroundWorkerEndpoint } from './playground-worker-endpoint';
import { randomString } from '@php-wasm/util';
import {
	getSqliteDriverModuleDetails,
	getWordPressModuleDetails,
	LatestMinifiedWordPressVersion,
	LatestSqliteDriverVersion,
	MinifiedWordPressVersionsList,
} from '@wp-playground/wordpress-builds';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { bootWordPress } from '@wp-playground/wordpress';
import { createDirectoryHandleMountHandler } from '@php-wasm/web';
import type { PHP } from '@php-wasm/universal';
/* @ts-ignore */
import { corsProxyUrl as defaultCorsProxyUrl } from 'virtual:cors-proxy-url';
import type { WorkerBootOptions } from './playground-worker-endpoint';

// post message to parent
self.postMessage('worker-script-started');

const downloadMonitor = new EmscriptenDownloadMonitor();

class ArtifactExpiredError extends Error {
	constructor(message = 'GitHub artifact expired') {
		super(message);
		this.name = 'ArtifactExpiredError';
	}
}

class PlaygroundWorkerEndpointBlueprintsV1 extends PlaygroundWorkerEndpoint {
	override async boot({
		scope,
		mounts = [],
		wpVersion = LatestMinifiedWordPressVersion,
		sqliteDriverVersion = LatestSqliteDriverVersion,
		phpVersion,
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
			corsProxyUrl = defaultCorsProxyUrl as any;
		}
		this.booted = true;
		this.scope = scope;

		try {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
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
				phpVersion: phpVersion!,
			});

			this.requestedWordPressVersion =
				wpVersion === 'nightly' ? 'trunk' : wpVersion;
			wpVersion = MinifiedWordPressVersionsList.includes(
				this.requestedWordPressVersion
			)
				? this.requestedWordPressVersion
				: LatestMinifiedWordPressVersion;

			const wpDetails = getWordPressModuleDetails(wpVersion);
			let wordPressRequest: Promise<Response> | null = null;
			if (shouldInstallWordPress) {
				if (this.requestedWordPressVersion!.startsWith('http')) {
					wordPressRequest = this.downloadMonitor
						.monitorFetch(
							fetch(this.requestedWordPressVersion as string)
						)
						.then((response) => {
							if (response.ok) {
								return response;
							}
							let json: any = null;
							return response.json().then(
								(parsedJson) => {
									json = parsedJson;
									if (
										json &&
										json.error === 'artifact_expired'
									) {
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
					const downloadUrl = maybeProxyUrl(
						wpDetails.url,
						corsProxyUrl as string | undefined
					);
					this.downloadMonitor.expectAssets({
						[downloadUrl]: wpDetails.size,
					});
					wordPressRequest = this.downloadMonitor.monitorFetch(
						fetch(downloadUrl)
					);
				}
			}

			let sqliteIntegrationRequest: Promise<Response> | null = null;
			const sqliteDriverModuleDetails = getSqliteDriverModuleDetails(
				sqliteDriverVersion!
			);
			this.downloadMonitor.expectAssets({
				[sqliteDriverModuleDetails.url]: sqliteDriverModuleDetails.size,
			});
			sqliteIntegrationRequest = this.downloadMonitor.monitorFetch(
				fetch(sqliteDriverModuleDetails.url)
			);

			await bootWordPress(requestHandler, {
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
				// Do not await the WordPress download or the sqlite integration download.
				// Let bootWordPress start the PHP runtime download first, and then await
				// all the ZIP files right before they're used.
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
			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e as Error;
		}
	}
}

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointBlueprintsV1(downloadMonitor)
);

function maybeProxyUrl(url: string, corsProxyUrl?: string) {
	if (
		!corsProxyUrl ||
		!url.startsWith('https://github.com/WordPress/WordPress/archive/')
	) {
		return url;
	}
	return `${corsProxyUrl}${url}`;
}
