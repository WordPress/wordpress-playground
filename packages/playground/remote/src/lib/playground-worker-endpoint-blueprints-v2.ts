import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import {
	PlaygroundWorkerEndpoint,
	type WorkerBootOptions,
} from './playground-worker-endpoint';
import {
	compileBlueprintV2,
	type BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import { ProgressTracker } from '@php-wasm/progress';
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
		withIntl = false,
		withNetworking = true,
		corsProxyUrl,
		blueprint,
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
		this.requestedWordPressVersion = wpVersion;

		try {
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
				pathAliases,
			});
			const primaryPhp = await requestHandler.getPrimaryPhp();

			if (!blueprint) {
				throw new Error(
					'Blueprints v2 runner requires a blueprint declaration.'
				);
			}

			const progress = new ProgressTracker();
			progress.addEventListener('progress', ((event: CustomEvent) => {
				this.dispatchEvent({
					type: 'blueprint.message',
					message: {
						type: 'blueprint.progress',
						progress: event.detail.progress * 100,
						caption: event.detail.caption ?? '',
					},
				});
			}) as EventListener);

			const compiled = await compileBlueprintV2(
				blueprint as BlueprintV2Declaration,
				{
					progress,
					corsProxy: corsProxyUrl,
				}
			);

			this.dispatchEvent({
				type: 'blueprint.message',
				message: {
					type: 'blueprint.target_resolved',
					runtimeConfig: compiled.runtimeConfig,
				},
			});

			await compiled.run(primaryPhp);

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
