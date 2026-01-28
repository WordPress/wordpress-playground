import type { ProgressTracker } from '@php-wasm/progress';
import {
	type PlaygroundClient,
	type StartPlaygroundOptions,
	compileBlueprintV1,
	runBlueprintV1Steps,
	resolveRuntimeConfiguration,
	BlueprintReflection,
} from '.';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';

export class BlueprintsV1Handler {
	private readonly options: StartPlaygroundOptions;

	constructor(options: StartPlaygroundOptions) {
		this.options = options;
	}

	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			onBlueprintValidated,
			onBlueprintStepCompleted,
			corsProxy,
			gitAdditionalHeadersCallback,
			mounts,
			sapiName,
			scope,
			shouldInstallWordPress,
			sqliteDriverVersion,
			wordpressInstallMode,
			onClientConnected,
		} = this.options;
		const executionProgress = progressTracker!.stage(0.5);
		const downloadProgress = progressTracker!.stage();

		// Set a default blueprint if none is provided.
		const blueprint = this.options.blueprint || {};

		// Connect the Comlink API client to the remote worker,
		// boot the playground, and run the blueprint steps.
		const playground = consumeAPI<PlaygroundClient>(
			iframe.contentWindow!,
			iframe.ownerDocument!.defaultView!
		) as PlaygroundClient;
		await playground.isConnected();
		progressTracker.pipe(playground);

		const runtimeConfiguration =
			await resolveRuntimeConfiguration(blueprint);
		await playground.onDownloadProgress(downloadProgress.loadingListener);
		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			shouldInstallWordPress,
			wordpressInstallMode,
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion: runtimeConfiguration.wpVersion,
			withIntl: runtimeConfiguration.intl,
			withNetworking: runtimeConfiguration.networking,
			corsProxyUrl: corsProxy,
			sqliteDriverVersion,
		});
		await playground.isReady();
		downloadProgress.finish();

		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		const reflection = await BlueprintReflection.create(blueprint);
		if (reflection.getVersion() === 1) {
			const compiled = await compileBlueprintV1(blueprint, {
				progress: executionProgress,
				onStepCompleted: onBlueprintStepCompleted,
				onBlueprintValidated,
				corsProxy,
				gitAdditionalHeadersCallback,
			});
			await runBlueprintV1Steps(compiled, playground);
		}

		/**
		 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
		 *
		 * @see https://github.com/WordPress/wordpress-playground/pull/2295
		 */
		if (runtimeConfiguration.networking) {
			await playground.prefetchUpdateChecks();
		}

		return playground;
	}
}
