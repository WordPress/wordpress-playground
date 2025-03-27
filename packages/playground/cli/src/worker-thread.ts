import {
	PHP,
	PHPRequestHandler,
	PHPWorker,
	SupportedPHPVersion,
	consumeAPI,
	exposeAPI,
	proxyFileSystem,
	rotatePHPRuntime,
} from '@php-wasm/universal';
import {
	createNodeFsMountHandler,
	loadNodeRuntime,
	FileLockManager,
} from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { zipDirectory } from '@wp-playground/common';
import { parentPort } from 'worker_threads';
import {
	bootWordPress,
	getFileNotFoundActionForWordPress,
	preloadPhpInfoRoute,
	wordPressRewriteRules,
} from '@wp-playground/wordpress';
import { logger } from '@php-wasm/logger';
import { rootCertificates } from 'tls';
import nodeEndpoint from 'comlink/dist/esm/node-adapter';
import { joinPaths } from '@php-wasm/util';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

export type PrimaryWorkerBootOptions = {
	wpVersion?: string;
	phpVersion?: SupportedPHPVersion;
	absoluteUrl: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	shouldInstallWordPress: boolean;
	wordPressZip?: ArrayBuffer;
	sqliteIntegrationPluginZip?: ArrayBuffer;
	runtimeIdBase: number;
};

export type SecondaryWorkerBootOptions = {
	phpVersion?: SupportedPHPVersion;
	absoluteUrl: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	runtimeIdBase: number;
};

function mountResources(php: PHP, mounts: Mount[]) {
	for (const mount of mounts) {
		php.mkdir(mount.vfsPath);
		php.mount(mount.vfsPath, createNodeFsMountHandler(mount.hostPath));
	}
}

export class PlaygroundCliWorker extends PHPWorker {
	booted = false;

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

	async boot({
		absoluteUrl,
		mountsBeforeWpInstall,
		mountsAfterWpInstall,
		phpVersion = '8.0',
		wordPressZip,
		sqliteIntegrationPluginZip,
		runtimeIdBase,
	}: PrimaryWorkerBootOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}
		this.booted = true;

		const fileLockManager = consumeAPI<FileLockManager>(parentPort!);
		await fileLockManager.isConnected();

		try {
			const constants: Record<string, string | number | boolean | null> =
				{
					WP_DEBUG: true,
					WP_DEBUG_LOG: true,
					WP_DEBUG_DISPLAY: false,
				};

			logger.log(`Booting WordPress...`);
			const requestHandler = await bootWordPress({
				siteUrl: absoluteUrl,
				createPhpRuntime: async () => {
					return await loadNodeRuntime(phpVersion, {
						emscriptenOptions: {
							fileLockManager,
							runtimeIdBase,
						},
					});
				},
				wordPressZip:
					wordPressZip !== undefined
						? new File([wordPressZip], 'wordpress.zip')
						: undefined,
				sqliteIntegrationPluginZip:
					sqliteIntegrationPluginZip !== undefined
						? new File(
								[sqliteIntegrationPluginZip],
								'sqlite-integration-plugin.zip'
						  )
						: undefined,
				sapiName: 'cli',
				createFiles: {
					'/internal/shared/ca-bundle.crt':
						rootCertificates.join('\n'),
				},
				constants,
				phpIniEntries: {
					'openssl.cafile': '/internal/shared/ca-bundle.crt',
					allow_url_fopen: '1',
					disable_functions: '',
				},
				hooks: {
					async beforeWordPressFiles(php) {
						mountResources(php, mountsBeforeWpInstall);
					},
				},
				cookieStore: false,
			});
			this.__internal_setRequestHandler(requestHandler);
			logger.log(`Booted!`);

			const php = await requestHandler.getPrimaryPhp();
			// TODO: Restore logic to zipDirectory prior to mounting
			mountResources(php, mountsAfterWpInstall);

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}

	// TODO: Fix the secondary boot setup. Request routing does not seem to be properly set up
	// because there are 404s for static files.
	async bootSecondaryWorker({
		absoluteUrl,
		mountsBeforeWpInstall,
		mountsAfterWpInstall,
		phpVersion = '8.0',
		runtimeIdBase,
	}: SecondaryWorkerBootOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}
		this.booted = true;

		const fileLockManager = consumeAPI<FileLockManager>(parentPort!);
		await fileLockManager.isConnected();

		try {
			// TODO: Create request handler from scratch
			// TODO: Likely remove this log message
			logger.log(`Booting secondary worker...`);

			const requestHandler: PHPRequestHandler = new PHPRequestHandler({
				phpFactory: async ({ isPrimary }) =>
					createPhp(requestHandler, isPrimary),
				// TODO: Consider adding explicit documentRoot param for booting worker
				documentRoot: '/wordpress',
				absoluteUrl,
				rewriteRules: wordPressRewriteRules,
				getFileNotFoundAction: getFileNotFoundActionForWordPress,
				cookieStore: false,
			});

			this.__internal_setRequestHandler(requestHandler);
			// TODO: Likely remove this log message
			logger.log(`Booted secondary worker!`);

			const php = await requestHandler.getPrimaryPhp();
			mountResources(php, mountsBeforeWpInstall);
			mountResources(php, mountsAfterWpInstall);

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}

		async function createPhpRuntime() {
			return await loadNodeRuntime(phpVersion, {
				emscriptenOptions: {
					fileLockManager,
					runtimeIdBase,
				},
			});
		}

		// TODO: This is copied from wordpress/boot. Consider what actually makes sense to avoid unnecessarily duplicated logic.
		async function createPhp(
			requestHandler: PHPRequestHandler,
			isPrimary: boolean
		) {
			const php = new PHP(await createPhpRuntime());
			php.setSapiName('cli');
			if (requestHandler) {
				php.requestHandler = requestHandler;
			}
			/**
			 * Set up mu-plugins in /internal/shared/mu-plugins
			 * using auto_prepend_file to provide platform-level
			 * customization without altering the installed WordPress
			 * site.
			 *
			 * We only do that in the primary PHP instance –
			 * the filesystem there is the source of truth
			 * for all other PHP instances.
			 */
			if (isPrimary) {
				await preloadPhpInfoRoute(
					php,
					joinPaths(new URL(absoluteUrl).pathname, 'phpinfo.php')
				);
			} else {
				// Proxy the filesystem for all secondary PHP instances to
				// the primary one.
				proxyFileSystem(await requestHandler.getPrimaryPhp(), php, [
					'/tmp',
					requestHandler.documentRoot,
					'/internal/shared',
				]);
			}

			// Rotate the PHP runtime periodically to avoid memory leak-related crashes.
			// @see https://github.com/WordPress/wordpress-playground/pull/990 for more context
			rotatePHPRuntime({
				php,
				cwd: requestHandler.documentRoot,
				recreateRuntime: createPhpRuntime,
				maxRequests: 400,
			});

			return php;
		}
	}
}

// post message to parent
parentPort!.postMessage('worker-script-started');

const workerParentEndpoint = nodeEndpoint(parentPort!);
const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundCliWorker(new EmscriptenDownloadMonitor()),
	workerParentEndpoint
);
