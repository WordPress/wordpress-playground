import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import { PlaygroundWorkerEndpoint } from './playground-worker-endpoint';
import type { WorkerBootOptions } from './playground-worker-endpoint';
import { runBlueprintV2 } from '@wp-playground/blueprints';
import type { BlueprintV2Declaration } from '@wp-playground/blueprints';
/* @ts-ignore */
import { corsProxyUrl as defaultCorsProxyUrl } from 'virtual:cors-proxy-url';

// post message to parent
self.postMessage('worker-script-started');

const downloadMonitor = new EmscriptenDownloadMonitor();

class PlaygroundWorkerEndpointV2 extends PlaygroundWorkerEndpoint {
	override async boot({
		scope,
		// mounts = [],
		wpVersion,
		phpVersion,
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
			corsProxyUrl = defaultCorsProxyUrl as any;
		}
		this.booted = true;
		this.scope = scope;
		this.requestedWordPressVersion = wpVersion;

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
				phpVersion: phpVersion!,
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
			setApiReady();
		} catch (e) {
			setAPIError(e as Error);
			throw e as Error;
		}
	}
}

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointV2(downloadMonitor)
);