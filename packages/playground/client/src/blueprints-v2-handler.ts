import type { ProgressTracker } from '@php-wasm/progress';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';
import type { PHPWebExtension } from '@php-wasm/web';
import {
	compileBlueprintForExecution,
	resolveRuntimeConfiguration,
} from '@wp-playground/blueprints';
import type { PlaygroundClient, StartPlaygroundWebOptions } from '.';

type WordPressInstallMode = NonNullable<
	StartPlaygroundWebOptions['wordpressInstallMode']
>;

/**
 * Boots Playground and runs Blueprint declarations with the native TypeScript
 * Blueprint compiler.
 */
export class BlueprintsV2Handler {
	private readonly options: StartPlaygroundWebOptions;

	constructor(options: StartPlaygroundWebOptions) {
		this.options = options;
	}

	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			onBlueprintValidated,
			onBlueprintStepCompleted,
			onClientConnected,
			corsProxy,
			gitAdditionalHeadersCallback,
			mounts,
			sapiName,
			scope,
			shouldInstallWordPress,
			sqliteDriverVersion,
			wordpressInstallMode,
			pathAliases,
			disableProgressBar,
		} = this.options;
		const executionProgress = progressTracker.stage(0.5);
		const downloadProgress = progressTracker.stage();
		const blueprint = this.options.blueprint || { version: 2 };

		// Connect the Comlink API client to the remote worker,
		// boot the playground, and run the blueprint steps.
		const playground = consumeAPI<PlaygroundClient>(
			iframe.contentWindow!,
			iframe.ownerDocument!.defaultView!
		) as PlaygroundClient;
		await playground.isConnected();
		if (!disableProgressBar) {
			progressTracker.pipe(playground);
		}

		// Connect the Comlink API client to the remote worker download monitor
		await playground.onDownloadProgress(downloadProgress.loadingListener);

		const compiled = await compileBlueprintForExecution(blueprint, {
			progress: executionProgress,
			onStepCompleted: onBlueprintStepCompleted,
			onBlueprintValidated,
			corsProxy,
			gitAdditionalHeadersCallback,
		});
		const runtimeConfiguration =
			compiled.version === 2
				? compiled.compiled.runtime
				: await resolveRuntimeConfiguration(compiled.declaration);
		const resolvedWordPressInstallMode = resolveWordPressInstallMode({
			shouldInstallWordPress,
			wordpressInstallMode,
		});

		const extensions: PHPWebExtension[] = runtimeConfiguration.intl
			? ['intl']
			: [];
		extensions.push(...(this.options.extensions || []));

		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			wordpressInstallMode: resolvedWordPressInstallMode,
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion: runtimeConfiguration.wpVersion,
			extensions,
			withNetworking: runtimeConfiguration.networking,
			corsProxyUrl: corsProxy,
			sqliteDriverVersion,
			pathAliases,
		});
		await playground.isReady();
		downloadProgress.finish();

		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		await compiled.run(playground);

		return playground;
	}
}

function resolveWordPressInstallMode({
	shouldInstallWordPress,
	wordpressInstallMode,
}: {
	shouldInstallWordPress: StartPlaygroundWebOptions['shouldInstallWordPress'];
	wordpressInstallMode: StartPlaygroundWebOptions['wordpressInstallMode'];
}): WordPressInstallMode {
	return (
		wordpressInstallMode ??
		(shouldInstallWordPress === false
			? 'install-from-existing-files-if-needed'
			: 'download-and-install')
	);
}
