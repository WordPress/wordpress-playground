import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { logger } from '@php-wasm/logger';
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
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { bootWordPress } from '@wp-playground/wordpress';
import { createDirectoryHandleMountHandler } from '@php-wasm/web';
import type { PHP, FileTree } from '@php-wasm/universal';
import { createSABMemFSBuffers, sabMemFSMount } from '@php-wasm/universal';
import { WorkerPoolInstanceManager } from './worker-pool-instance-manager';
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
		withIntl = false,
		withNetworking = true,
		shouldInstallWordPress = true,
		wordpressInstallMode = 'install-from-existing-files-if-needed',
		corsProxyUrl,
		useSABMemFS = false,
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
				withIntl,
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

			const sqliteDriverModuleDetails = getSqliteDriverModuleDetails(
				sqliteDriverVersion!
			);
			this.downloadMonitor.expectAssets({
				[sqliteDriverModuleDetails.url]: sqliteDriverModuleDetails.size,
			});
			const sqliteIntegrationRequest = this.downloadMonitor.monitorFetch(
				fetch(sqliteDriverModuleDetails.url)
			);

			// Detect early whether to use SABMEMFS so we can mount it
			// before WordPress files are extracted. This way, all
			// files go directly into the SharedArrayBuffer-backed FS
			// and no post-boot copy is needed.
			const enableSABMemFS =
				useSABMemFS ||
				(typeof SharedArrayBuffer !== 'undefined' &&
					typeof crossOriginIsolated !== 'undefined' &&
					crossOriginIsolated);
			logger.log(
				`[SABMEMFS] crossOriginIsolated=${typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : 'N/A'}, enableSABMemFS=${enableSABMemFS}`
			);

			const wpBuffers = enableSABMemFS
				? createSABMemFSBuffers()
				: null;

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
						// Mount SABMEMFS at /wordpress before WordPress
						// files are extracted. This way all files go
						// directly into SharedArrayBuffer storage and
						// no post-boot copy step is needed.
						// multiWorker mode enables Atomics-based locking
						// for safe concurrent access from sub-workers.
						if (wpBuffers) {
							if (!php.fileExists('/wordpress')) {
								php.mkdir('/wordpress');
							}
							await php.mount(
								'/wordpress',
								sabMemFSMount(wpBuffers, { multiWorker: true })
							);
							logger.log(
								'[SABMEMFS] Mounted at /wordpress before extraction (multiWorker=true)'
							);
						}

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

			if (enableSABMemFS && wpBuffers) {
				logger.log('[SABMEMFS] WordPress booted on SABMEMFS');

				const primaryPhp = await requestHandler.getPrimaryPhp();
				const workerPool = new WorkerPoolInstanceManager({
					primaryPhp,
					maxWorkers: 2,
					subWorkerConfig: {
						phpVersion: phpVersion!,
						withIntl,
						sapiName,
						phpIniEntries: this.lastPhpIniEntries,
						sabBuffers: wpBuffers,
						documentRoot: requestHandler.documentRoot,
						siteUrl,
						corsProxyUrl: corsProxyUrl as string | undefined,
						withNetworking,
						constants: shouldInstallWordPress
							? {
									WP_DEBUG: true,
									WP_DEBUG_LOG: true,
									WP_DEBUG_DISPLAY: false,
								}
							: {},
						internalFiles: readDirAsFileTree(
							primaryPhp,
							'/internal/shared'
						),
					},
				});
				requestHandler.instanceManager = workerPool;
				this.workerPool = workerPool;
				logger.log(
					'[WorkerPool] Replaced instance manager with worker pool (maxWorkers=2)'
				);
			}

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

/**
 * Recursively read a directory from a PHP instance's filesystem and
 * return it as a FileTree suitable for writeFiles(). This lets us
 * capture all the files that setupPlatformLevelMuPlugins() and
 * bootRequestHandler() wrote to /internal/shared and replicate
 * them in each sub-worker's local MEMFS.
 */
function readDirAsFileTree(php: PHP, dirPath: string): FileTree {
	const tree: FileTree = {};
	if (!php.fileExists(dirPath)) {
		return tree;
	}
	// Build the tree under the directory's own path segments
	// so that writeFiles(php, '/', tree) recreates the full path.
	const segments = dirPath.split('/').filter(Boolean);
	let current = tree;
	for (let i = 0; i < segments.length - 1; i++) {
		const child: FileTree = {};
		current[segments[i]] = child;
		current = child;
	}
	const lastSegment = segments[segments.length - 1];
	current[lastSegment] = readDirContents(php, dirPath);
	return tree;
}

/** Extensions that are safe to read as UTF-8 text. */
const TEXT_EXTENSIONS = new Set([
	'.php',
	'.txt',
	'.html',
	'.htm',
	'.css',
	'.js',
	'.json',
	'.xml',
	'.svg',
	'.md',
	'.crt',
	'.pem',
	'.ini',
	'.yml',
	'.yaml',
	'.conf',
	'.cfg',
	'.htaccess',
]);

function isTextFile(name: string): boolean {
	const dot = name.lastIndexOf('.');
	return dot >= 0 && TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

function readDirContents(php: PHP, dirPath: string): FileTree {
	const tree: FileTree = {};
	const entries = php.listFiles(dirPath);
	for (const entry of entries) {
		const fullPath = dirPath + '/' + entry;
		if (php.isDir(fullPath)) {
			tree[entry] = readDirContents(php, fullPath);
		} else if (isTextFile(entry)) {
			tree[entry] = php.readFileAsText(fullPath);
		} else {
			tree[entry] = php.readFileAsBuffer(fullPath);
		}
	}
	return tree;
}
