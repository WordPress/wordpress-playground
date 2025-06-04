import type { PHP, SupportedPHPVersion } from '@php-wasm/universal';
import { PHPWorker, consumeAPI, exposeAPI } from '@php-wasm/universal';
import type { FileLockManager } from '@php-wasm/node';
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { zipDirectory } from '@wp-playground/common';
import { parentPort } from 'worker_threads';
import { bootWordPress } from '@wp-playground/wordpress';
import { rootCertificates } from 'tls';

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
	wordPressZip?: ArrayBuffer;
	sqliteIntegrationPluginZip?: ArrayBuffer;
	processIdBase: number;
	dataSqlPath?: string;
	followSymlinks: boolean;
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
		processIdBase,
		dataSqlPath,
		followSymlinks,
	}: PrimaryWorkerBootOptions) {
		if (this.booted) {
			throw new Error('Playground already booted');
		}
		this.booted = true;

		let nextProcessId = processIdBase;
		const fileLockManager = consumeAPI<FileLockManager>(parentPort!);
		await fileLockManager.isConnected();

		try {
			const constants: Record<string, string | number | boolean | null> =
				{
					WP_DEBUG: true,
					WP_DEBUG_LOG: true,
					WP_DEBUG_DISPLAY: false,
				};

			const requestHandler = await bootWordPress({
				siteUrl: absoluteUrl,
				createPhpRuntime: async () => {
					const processId = nextProcessId;
					nextProcessId++;
					return await loadNodeRuntime(phpVersion, {
						emscriptenOptions: {
							fileLockManager,
							processId,
						},
						followSymlinks,
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
				dataSqlPath,
			});
			this.__internal_setRequestHandler(requestHandler);

			const primaryPhp = await requestHandler.getPrimaryPhp();
			await this.setPrimaryPHP(primaryPhp);

			// TODO: Restore logic to zipDirectory prior to mounting
			mountResources(primaryPhp, mountsAfterWpInstall);

			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e;
		}
	}
}

// post message to parent
parentPort!.postMessage('worker-script-started');

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundCliWorker(new EmscriptenDownloadMonitor()),
	undefined,
	parentPort!
);
