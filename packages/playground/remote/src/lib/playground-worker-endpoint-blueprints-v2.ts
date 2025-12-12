import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import {
	PHPWorkerGlobalScope,
	PlaygroundWorkerEndpoint,
	type WorkerBootOptions,
} from './playground-worker-endpoint';
import { runBlueprintV2 } from '@wp-playground/blueprints';
import type { BlueprintV2Declaration } from '@wp-playground/blueprints';
/* @ts-ignore */
import { corsProxyUrl as defaultCorsProxyUrl } from 'virtual:cors-proxy-url';

/*
 * Provide `setImmediate` so Emscripten doesn’t install its message-based
 * polyfill, which retains references to the Wasm HEAP and prevents the
 * PHP instance from being garbage-collected.
 *
 * https://github.com/emscripten-core/emscripten/blob/6d61ffd7076309cb08af37aba496f25c23cdb5a4/src/lib/libeventloop.js#L57
 */
(globalThis as PHPWorkerGlobalScope).setImmediate = (fn: () => void) =>
	setTimeout(fn, 0);

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

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointV2(downloadMonitor)
);
