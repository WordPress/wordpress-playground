import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import {
	PlaygroundWorkerEndpoint,
	type BootProgressEvent,
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
import {
	assertBlueprintV2WordPressVersionCompatibility,
	type BlueprintV2Declaration,
} from '@wp-playground/blueprints';
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

/**
 * Identifies a concrete WordPress release that wordpress.org cannot provide.
 *
 * This error is reserved for HTTP 404 responses from the versioned WordPress
 * download endpoint. Other HTTP responses and transport failures remain normal
 * download errors because retrying them or changing the network may succeed.
 *
 * Errors crossing the worker boundary may lose their prototype, but retain the
 * class name as `originalErrorClassName`. Giving this condition a stable name
 * lets the website show unavailable-resource guidance instead of treating it as
 * a transient download failure.
 */
class ResourceUnavailableError extends Error {
	/**
	 * Creates an unavailable-resource error with a name that survives worker
	 * error serialization.
	 *
	 * @param message The exact resource and version that could not be downloaded.
	 */
	constructor(message: string) {
		super(message);
		this.name = 'ResourceUnavailableError';
	}
}

class PlaygroundWorkerEndpointBlueprints extends PlaygroundWorkerEndpoint {
	override async boot({
		scope,
		mounts = [],
		wpVersion = LatestMinifiedWordPressVersion,
		wordPressZip,
		sqliteDriverVersion = LatestSqliteDriverVersion,
		phpVersion,
		sapiName = 'cli',
		extensions = [],
		withNetworking = true,
		shouldInstallWordPress,
		wordpressInstallMode,
		blueprint,
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
			const resolvedWordPressInstallMode: WordPressInstallMode =
				wordpressInstallMode ??
				(shouldInstallWordPress === false
					? 'install-from-existing-files-if-needed'
					: 'download-and-install');
			const siteUrl = this.computeSiteUrl(scope);
			const reportBootProgress = (caption: string) => {
				this.dispatchEvent<BootProgressEvent>({
					type: 'boot.progress',
					caption,
				});
			};

			reportBootProgress('Creating Playground request handler');
			const requestHandler = await this.createRequestHandler({
				siteUrl,
				sapiName,
				corsProxyUrl,
				knownRemoteAssetPaths,
				extensions,
				withNetworking,
				phpVersion: phpVersion!,
				pathAliases,
				onProgress: reportBootProgress,
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
			// Only tar.zst descriptors opt into the streaming extractor's file-count
			// parity check. Custom URLs and wordpress.org ZIPs skip it.
			let expectedBundleFileCount: number | undefined;
			if (
				resolvedWordPressInstallMode === 'download-and-install' &&
				!wordPressZip
			) {
				reportBootProgress('Preparing WordPress download');
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
					/^\d+\.\d+(?:\.\d+)?(?:-(?:beta|rc)\d+)?$/i.test(
						this.requestedWordPressVersion!
					)
				) {
					// Non-minified release like "4.9", "6.8.0", or
					// "7.0-RC1": download directly from wordpress.org.
					// Sentinel values like "latest" fall through to the
					// minified-bundle branch below and resolve to
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
								if (response.status === 404) {
									throw new ResourceUnavailableError(
										`WordPress ${normalizedVersion} is not available for download.`
									);
								}
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
					expectedBundleFileCount =
						wpDetails.format === 'tar.zst'
							? wpDetails.fileCount
							: undefined;
					wordPressRequest = this.downloadMonitor.monitorFetch(
						fetch(downloadUrl)
					);
				}
			}

			// PHP-only mode: the caller asked us to skip WordPress boot entirely.
			// Apply mounts and stop, so the caller gets a usable PHP runtime.
			if (resolvedWordPressInstallMode === 'do-not-attempt-installing') {
				reportBootProgress('Creating PHP runtime');
				const primaryPhp = await requestHandler.getPrimaryPhp();
				for (const mount of mounts) {
					reportBootProgress('Mounting WordPress files');
					await endpoint.mountOpfsIntoPhp(primaryPhp, mount);
				}
				this.__internal_setRequestHandler(requestHandler);
				reportBootProgress('PHP runtime ready');
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
			reportBootProgress('Preparing SQLite integration download');
			const sqliteIntegrationRequest = this.downloadMonitor.monitorFetch(
				fetch(sqliteDriverModuleDetails.url)
			);

			reportBootProgress('Booting WordPress');
			await bootWordPress(requestHandler, {
				siteUrl,
				phpVersion,
				constants:
					resolvedWordPressInstallMode === 'download-and-install'
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
				wordpressInstallMode: resolvedWordPressInstallMode,
				// Do not await the WordPress download or the sqlite integration download.
				// Let bootWordPress start the PHP runtime download first, and then await
				// all the ZIP files right before they're used.

				// We use .arrayBuffer() and not .blob() here because blob() throws when the
				// client is low on disk space. Blobs tend to be stored as temporary files,
				// array buffers tend to be stored in memory.
				// @see https://github.com/WordPress/wordpress-playground/issues/2769
				wordPressZip:
					wordPressZip ??
					wordPressRequest
						?.then((r) => r.arrayBuffer())
						.then((b) => new File([b], 'wp.bundle')),
				wordPressBundleFileCount: expectedBundleFileCount,
				sqliteIntegrationPluginZip: sqliteIntegrationRequest
					.then((r) => r.arrayBuffer())
					.then((b) => new File([b], 'sqlite.zip')),
				hooks: {
					async beforeWordPressFiles(php: PHP) {
						for (const mount of mounts) {
							await endpoint.mountOpfsIntoPhp(php, mount);
						}
						if (
							(blueprint as { version?: unknown } | undefined)
								?.version === 2 &&
							(resolvedWordPressInstallMode ===
								'install-from-existing-files' ||
								resolvedWordPressInstallMode ===
									'install-from-existing-files-if-needed') &&
							php.fileExists('/wordpress/wp-includes/version.php')
						) {
							const installedVersion = await php.run({
								code: `<?php
									require '/wordpress/wp-includes/version.php';
									echo $wp_version;
								`,
							});
							await assertBlueprintV2WordPressVersionCompatibility(
								blueprint as BlueprintV2Declaration,
								installedVersion.text.trim()
							);
						}
					},
				},
				onProgress: reportBootProgress,
			});

			reportBootProgress('Finalizing WordPress runtime');
			await this.finalizeAfterBoot(
				requestHandler,
				withNetworking,
				knownRemoteAssetPaths
			);
			reportBootProgress('WordPress runtime ready');
			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e as Error;
		}
	}
}

type WordPressInstallMode = NonNullable<
	WorkerBootOptions['wordpressInstallMode']
>;

const workerGlobal = self as unknown as {
	__playgroundWorkerEndpointBlueprints?: boolean;
};
const alreadyExposedComlinkEndpoint =
	workerGlobal.__playgroundWorkerEndpointBlueprints;
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
		'The Blueprints Playground worker tried to expose its Comlink endpoint more than once in the same worker global. This usually means the worker entrypoint was imported as a dependency. Worker entrypoints must not be imported; move shared code into a side-effect-free module instead.'
	);
}
workerGlobal.__playgroundWorkerEndpointBlueprints = true;
const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointBlueprints(downloadMonitor)
);

/**
 * Normalizes WordPress version strings for wordpress.org downloads.
 *
 * Exact initial releases use `<major>.<minor>.0` internally but wordpress.org
 * names their archives `<major>.<minor>`. RC archive names also use uppercase
 * `RC`. Versions before 2.0 retain their historical archive aliases.
 */
function normalizeWordPressVersion(version: string): string {
	const legacyVersionMap: Record<string, string> = {
		'0.7': '0.71-gold',
		'0.71': '0.71-gold',
		'1.0': '1.0.2',
		'1.2': '1.2.2',
		'1.5': '1.5.2',
	};
	const normalizedVersion = version
		.replace(/^(\d+\.\d+)\.0$/, '$1')
		.replace(/-rc(\d+)$/i, '-RC$1');
	return legacyVersionMap[normalizedVersion] ?? normalizedVersion;
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
