import type { ProgressTracker } from '@php-wasm/progress';
import type { PlaygroundClient, StartPlaygroundOptions } from '.';
import { collectPhpLogs, logger } from '@php-wasm/logger';

export class BlueprintsV2Handler {
	constructor(private readonly options: StartPlaygroundOptions) {}

	async bootPlayground(
		playground: PlaygroundClient,
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
	}
}
