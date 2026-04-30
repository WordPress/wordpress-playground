import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import {
	PlaygroundWorkerEndpoint,
	type WorkerBootOptions,
} from './playground-worker-endpoint';
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
		extensions = [],
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
				extensions,
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

			const streamed = await runBlueprintV2({
				php: primaryPhp,
				cliArgs: ['--site-url=' + siteUrl],
				blueprint: blueprint as BlueprintV2Declaration,
				onMessage: async (message: any) => {
					this.dispatchEvent({
						type: 'blueprint.message',
						message,
					});
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

const workerGlobal = self as unknown as {
	__playgroundWorkerEndpointBlueprintsV2?: boolean;
};
const alreadyExposedComlinkEndpoint =
	workerGlobal.__playgroundWorkerEndpointBlueprintsV2;
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
		'The Blueprints v2 Playground worker tried to expose its Comlink endpoint more than once in the same worker global. This usually means the worker entrypoint was imported as a dependency. Worker entrypoints must not be imported; move shared code into a side-effect-free module instead.'
	);
}
workerGlobal.__playgroundWorkerEndpointBlueprintsV2 = true;
const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointV2(downloadMonitor)
);
