import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import {
	PlaygroundWorkerEndpoint,
	type WorkerBootOptions,
} from './playground-worker-endpoint';
import { randomString } from '@php-wasm/util';
import {
	getSqliteDriverModuleDetails,
	getWordPressModuleDetails,
	LatestMinifiedWordPressVersion,
	LatestSqliteDriverVersion,
	MinifiedWordPressVersionsList,
} from '@wp-playground/wordpress-builds';
import { isLegacyPHPVersion } from '@php-wasm/universal';
import { bootWordPress } from '@wp-playground/wordpress';
import type { PHP } from '@php-wasm/universal';
/* @ts-ignore */
import { corsProxyUrl as defaultCorsProxyUrl } from 'virtual:cors-proxy-url';

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
		extensions = [],
		withNetworking = true,
		shouldInstallWordPress = true,
		wordpressInstallMode = 'install-from-existing-files-if-needed',
		corsProxyUrl,
		pathAliases,
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
				corsProxyUrl,
				knownRemoteAssetPaths,
				extensions,
				withNetworking,
				phpVersion: phpVersion!,
				pathAliases,
			});

			this.requestedWordPressVersion =
				wpVersion === 'nightly' ? 'trunk' : wpVersion;
			const isMinifiedVersion = MinifiedWordPressVersionsList.includes(
				this.requestedWordPressVersion
			);
			wpVersion = isMinifiedVersion
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
				} else if (
					!isMinifiedVersion &&
					/^\d+\.\d+(\.\d+)?$/.test(this.requestedWordPressVersion!)
				) {
					// Non-minified dotted version like "4.9" or "1.5":
					// download directly from wordpress.org. Sentinel
					// values like "latest" fall through to the minified-
					// bundle branch below and resolve to
					// LatestMinifiedWordPressVersion.
					const normalizedVersion = normalizeWordPressVersion(
						this.requestedWordPressVersion!
					);
					const wpOrgUrl = `https://wordpress.org/wordpress-${normalizedVersion}.zip`;
					const downloadUrl = corsProxyUrl
						? `${corsProxyUrl}${wpOrgUrl}`
						: wpOrgUrl;
					wordPressRequest = this.downloadMonitor
						.monitorFetch(fetch(downloadUrl))
						.then((response) => {
							if (!response.ok) {
								throw new Error(
									`Failed to download WordPress ${normalizedVersion} (HTTP ${response.status})`
								);
							}
							return response;
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

			// PHP-only mode: the caller asked us to skip the WordPress
			// install, so there's nothing for `bootWordPress` to do — and
			// running it without WP files would still drop in the SQLite
			// shim and then assert a (nonexistent) DB connection. Apply the
			// OPFS mounts and stop, so the caller gets a usable PHP runtime.
			if (!shouldInstallWordPress) {
				const primaryPhp = await requestHandler.getPrimaryPhp();
				for (const mount of mounts) {
					await endpoint.mountOpfsIntoPhp(primaryPhp, mount);
				}
				this.__internal_setRequestHandler(requestHandler);
				setApiReady();
				return;
			}

			// Select the right SQLite version:
			// - PHP 5.2: pre-patched v3.0.0-rc.3 (closures replaced, PHP 5.2
			//   polyfills added)
			// - Everything else: whatever the caller requested
			const isLegacyPhp = isLegacyPHPVersion(phpVersion);
			const effectiveSqliteVersion = isLegacyPhp
				? 'v3.0.0-rc.3-php52'
				: sqliteDriverVersion!;
			const sqliteDriverModuleDetails = getSqliteDriverModuleDetails(
				effectiveSqliteVersion
			);
			this.downloadMonitor.expectAssets({
				[sqliteDriverModuleDetails.url]: sqliteDriverModuleDetails.size,
			});
			const sqliteIntegrationRequest = this.downloadMonitor.monitorFetch(
				fetch(sqliteDriverModuleDetails.url)
			);

			await bootWordPress(requestHandler, {
				siteUrl,
				phpVersion,
				constants: shouldInstallWordPress
					? {
							// Disable WP_DEBUG for legacy PHP (< 7) because
							// old WordPress (< 3.1) doesn't have WP_DEBUG_DISPLAY
							// and shows all notices when WP_DEBUG is true,
							// breaking header output and install responses.
							WP_DEBUG: !isLegacyPhp,
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
				// Passing this even when shouldInstallWordPress is false is counter-intuitive.
				// Before this line was introduced, `wordpressInstallMode` was always undefined
				// which defaulted to 'install-from-existing-files'. Using the `-if-needed` variant
				// saves around 600ms during the boot on a macbook pro so it's worth it.
				// @TODO: Deprecate the `shouldInstallWordPress` semantics entirely and get the client
				//        and the Playground website to pass `wordpressInstallMode` directly.
				wordpressInstallMode,
				// Do not await the WordPress download or the sqlite integration download.
				// Let bootWordPress start the PHP runtime download first, and then await
				// all the ZIP files right before they're used.

				// We use .arrayBuffer() and not .blob() here because blob() throws when the
				// client is low on disk space. Blobs tend to be stored as temporary files,
				// array buffers tend to be stored in memory.
				// @see https://github.com/WordPress/wordpress-playground/issues/2769
				wordPressZip: wordPressRequest
					?.then((r) => r.arrayBuffer())
					.then((b) => new File([b], 'wp.zip')),
				sqliteIntegrationPluginZip: sqliteIntegrationRequest
					.then((r) => r.arrayBuffer())
					.then((b) => new File([b], 'sqlite.zip')),
				hooks: {
					async beforeWordPressFiles(php: PHP) {
						for (const mount of mounts) {
							await endpoint.mountOpfsIntoPhp(php, mount);
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

const workerGlobal = self as unknown as {
	__playgroundWorkerEndpointBlueprintsV1?: boolean;
};
const alreadyExposedComlinkEndpoint =
	workerGlobal.__playgroundWorkerEndpointBlueprintsV1;
if (alreadyExposedComlinkEndpoint) {
	/*
	 * This worker entrypoint owns exactly one Comlink endpoint. Seeing this
	 * guard means the same module was evaluated twice in the same worker
	 * global, most likely because a generated chunk imported the worker
	 * entrypoint to reuse one of its exports. Keep shared imports in
	 * side-effect-free modules so loading PHP chunks cannot re-run worker
	 * startup code.
	 */
	throw new Error(
		'The Blueprints v1 Playground worker tried to expose its Comlink endpoint more than once in the same worker global. This usually means the worker entrypoint was imported as a dependency. Worker entrypoints must not be imported; move shared code into a side-effect-free module instead.'
	);
}
workerGlobal.__playgroundWorkerEndpointBlueprintsV1 = true;
const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointBlueprintsV1(downloadMonitor)
);

/**
 * Normalizes WordPress version strings for wordpress.org downloads.
 * Versions >= 2.0 work as `<major>.<minor>` (wordpress.org redirects
 * to the latest patch). Versions < 2.0 need explicit patch versions
 * because wordpress.org doesn't host `wordpress-1.x.zip` files.
 */
function normalizeWordPressVersion(version: string): string {
	const legacyVersionMap: Record<string, string> = {
		'1.0': '1.0.2',
		'1.2': '1.2.2',
		'1.5': '1.5.2',
	};
	return legacyVersionMap[version] ?? version;
}

function maybeProxyUrl(url: string, corsProxyUrl?: string) {
	if (
		!corsProxyUrl ||
		!url.startsWith('https://github.com/WordPress/WordPress/archive/')
	) {
		return url;
	}
	return `${corsProxyUrl}${url}`;
}
