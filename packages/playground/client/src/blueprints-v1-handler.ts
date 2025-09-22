import type { ProgressTracker } from '@php-wasm/progress';
import {
	type PlaygroundClient,
	type StartPlaygroundOptions,
	compileBlueprintV1,
	runBlueprintV1Steps,
	BlueprintReflection,
	type BlueprintV1,
} from '.';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';

export class BlueprintsV1Handler {
	constructor(private readonly options: StartPlaygroundOptions) {}

	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			onBlueprintValidated,
			onBlueprintStepCompleted,
			corsProxy,
			mounts,
			sapiName,
			scope,
			shouldInstallWordPress,
			sqliteDriverVersion,
			onClientConnected,
		} = this.options;
		const executionProgress = progressTracker!.stage(0.5);
		const downloadProgress = progressTracker!.stage();

		// Connect the Comlink API client to the remote worker,
		// boot the playground, and run the blueprint steps.
		const playground = consumeAPI<PlaygroundClient>(
			iframe.contentWindow!,
			iframe.ownerDocument!.defaultView!
		) as PlaygroundClient;
		await playground.isConnected();
		progressTracker.pipe(playground);

		await playground.onDownloadProgress(downloadProgress.loadingListener);

		const runtimeConfiguration = this.options.runtimeConfiguration;
		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			shouldInstallWordPress,
			corsProxyUrl: corsProxy,
			sqliteDriverVersion,

			// @TODO: Pass just one argument: runtimeConfiguration
			phpVersion: runtimeConfiguration?.phpVersion,
			wpVersion: runtimeConfiguration?.wpVersion,
			withICU: runtimeConfiguration?.intl ?? false,
			withNetworking: runtimeConfiguration?.networking ?? true,
		});
		await playground.isReady();
		downloadProgress.finish();

		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		/**
		 * Always run a Blueprint, even en empty one. The landingPage
		 * is handled by runBlueprintV1Steps() and without running the
		 * Blueprint, Playground never renders WordPress homepage.
		 */
		const reflection = await BlueprintReflection.create(
			this.options.blueprint || {}
		);
		const compiled = await compileBlueprintV1(
			reflection.getBlueprint() as BlueprintV1,
			{
				progress: executionProgress,
				onStepCompleted: onBlueprintStepCompleted,
				onBlueprintValidated,
				corsProxy,
			}
		);
		await runBlueprintV1Steps(compiled, playground);

		/**
		 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
		 *
		 * @see https://github.com/WordPress/wordpress-playground/pull/2295
		 */
		if (runtimeConfiguration?.networking ?? true) {
			await playground.prefetchUpdateChecks();
		}

		return playground;
	}
}
