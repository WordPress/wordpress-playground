import type { ProgressTracker } from '@php-wasm/progress';
import type { PlaygroundClient, StartPlaygroundOptions } from '.';
import { BlueprintReflection } from '@wp-playground/blueprints';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';

export class BlueprintsV2Handler {
	constructor(private readonly options: StartPlaygroundOptions) {}

	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			blueprint: rawBlueprint,
			onClientConnected,
			corsProxy,
			mounts,
			sapiName,
			scope,
			blueprintOverrides,
		} = this.options;
		const downloadProgress = progressTracker!.stage(0.25);
		const executionProgress = progressTracker!.stage(0.75);

		// Convert v1 blueprint to v2 if needed
		let blueprint: any = rawBlueprint;
		if (rawBlueprint) {
			const reflection = await BlueprintReflection.create(rawBlueprint);
			if (reflection.getVersion() === 1) {
				// Convert v1 to minimal v2 blueprint
				blueprint = {
					version: 2,
					wordpressVersion:
						blueprintOverrides?.blueprintOverrides
							?.wordpressVersion || 'latest',
				};
			}
		} else {
			// Create minimal v2 blueprint if none provided
			blueprint = {
				version: 2,
				wordpressVersion:
					blueprintOverrides?.blueprintOverrides?.wordpressVersion ||
					'latest',
			};
		}

		// Resolve runtime configuration to get PHP/WP versions
		const { resolveRuntimeConfiguration } = await import(
			'@wp-playground/blueprints'
		);
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			blueprint,
			blueprintOverrides
		);

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
		await playground.addEventListener(
			'blueprint.message',
			({ message }: any) => {
				switch (message.type) {
					case 'blueprint.target_resolved': {
						// @TODO: Evaluate consistenty with the CLI worker
						// if (!this.blueprintTargetResolved) {
						// 	this.blueprintTargetResolved = true;
						// 	for (const php of this
						// 		.phpInstancesThatNeedMountsAfterTargetResolved) {
						// 		// console.log('mounting resources for php', php);
						// 		this.phpInstancesThatNeedMountsAfterTargetResolved.delete(
						// 			php
						// 		);
						// 		await mountResources(php, args.mount || []);
						// 	}
						// }
						break;
					}
					case 'blueprint.progress': {
						executionProgress.set(message.progress);
						executionProgress.setCaption(message.caption);
						break;
					}
					case 'blueprint.error': {
						// @TODO: Error reporting.
						const red = '\x1b[31m';
						const bold = '\x1b[1m';
						const reset = '\x1b[0m';
						if (message.details) {
							logger.error(
								`${red}${bold}Fatal error:${reset} Uncaught ${message.details.exception}: ${message.details.message}\n` +
									`  at ${message.details.file}:${message.details.line}\n` +
									(message.details.trace
										? message.details.trace + '\n'
										: '')
							);
						} else {
							logger.error(
								`${red}${bold}Error:${reset} ${message.message}\n`
							);
						}

						// TODO: Should we report the error like that?
						throw new Error(message.message);
						break;
					}
				}
			}
		);

		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion: runtimeConfiguration.wpVersion,
			withICU: runtimeConfiguration.intl,
			withNetworking: runtimeConfiguration.networking,
			corsProxyUrl: corsProxy,
			experimentalBlueprintsV2Runner: true,
			// Pass the declaration directly – the worker runs the V2 runner.
			blueprint: blueprint as any,
			blueprintOverrides: blueprintOverrides?.blueprintOverrides,
		} as any);

		await playground.isReady();
		downloadProgress.finish();

		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		// Navigate to landing page from overrides or default to root
		const landingPage =
			blueprintOverrides?.applicationOptions?.landingPage || '/';
		playground.goTo(landingPage);

		/**
		 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
		 *
		 * @see https://github.com/WordPress/wordpress-playground/pull/2295
		 */
		// @TODO get the enabled features somehow – probably using the same
		//       resolveRuntimeConfiguration() logic as the redux site-slice.ts
		// if (compiled.features.networking) {
		// 	await playground.prefetchUpdateChecks();
		// }

		return playground;
	}
}
