import type { ProgressTracker } from '@php-wasm/progress';
import {
	PlaygroundClient,
	StartPlaygroundOptions,
	compileBlueprint,
	runBlueprintSteps,
} from '.';
import { collectPhpLogs, logger } from '@php-wasm/logger';

interface BootPlaygroundOptions extends StartPlaygroundOptions {
	playground: PlaygroundClient;
	progressTracker: ProgressTracker;
}
export class BlueprintsV1Handler {
	async bootPlayground({
		playground,
		blueprint,
		progressTracker,
		onBlueprintStepCompleted,
		corsProxy,
		mounts,
		sapiName,
		scope,
		shouldInstallWordPress,
		sqliteDriverVersion,
		onClientConnected,
	}: BootPlaygroundOptions) {
		const executionProgress = progressTracker!.stage(0.5);
		const downloadProgress = progressTracker!.stage();

		// Set a default blueprint if none is provided.
		if (!blueprint) {
			blueprint = {};
		}
		const compiled = await compileBlueprint(blueprint!, {
			progress: executionProgress,
			onStepCompleted: onBlueprintStepCompleted,
			corsProxy,
		});

		// Connect the Comlink API client to the remote worker,
		await playground.onDownloadProgress(downloadProgress.loadingListener);
		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			shouldInstallWordPress,
			phpVersion: compiled.versions.php,
			wpVersion: compiled.versions.wp,
			withICU: compiled.features.intl,
			withNetworking: compiled.features.networking,
			corsProxyUrl: corsProxy,
			sqliteDriverVersion,
		});
		await playground.isReady();
		downloadProgress.finish();

		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		await runBlueprintSteps(compiled, playground);

		/**
		 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
		 *
		 * @see https://github.com/WordPress/wordpress-playground/pull/2295
		 */
		if (compiled.features.networking) {
			await playground.prefetchUpdateChecks();
		}
	}
}
