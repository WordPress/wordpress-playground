import type { ProgressTracker } from '@php-wasm/progress';
import type { PlaygroundClient, StartPlaygroundOptions } from '.';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';

export class BlueprintsV2Handler {
	constructor(private readonly options: StartPlaygroundOptions) {}

	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			blueprint,
			onClientConnected,
			corsProxy,
			mounts,
			sapiName,
			scope,
		} = this.options;
		const downloadProgress = progressTracker!.stage();

		// Connect the Comlink API client to the remote worker,
		// boot the playground, and run the blueprint steps.
		const playground = consumeAPI<PlaygroundClient>(
			iframe.contentWindow!,
			iframe.ownerDocument!.defaultView!
		) as PlaygroundClient;
		await playground.isConnected();
		progressTracker.pipe(playground);

		// Connect the Comlink API client to the remote worker download monitor
		await playground.onDownloadProgress(downloadProgress.loadingListener);

		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			corsProxyUrl: corsProxy,
			experimentalBlueprintsV2Runner: true,
			// Pass the declaration directly – the worker runs the V2 runner.
			blueprint: blueprint as any,
		} as any);

		await playground.isReady();
		downloadProgress.finish();

		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		/**
		 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
		 *
		 * @see https://github.com/WordPress/wordpress-playground/pull/2295
		 */
		// @TODO
		// if (compiled.features.networking) {
		// 	await playground.prefetchUpdateChecks();
		// }

		return playground;
	}
}
