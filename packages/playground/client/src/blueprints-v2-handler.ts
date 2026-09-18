import type { ProgressTracker } from '@php-wasm/progress';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';
import type { PHPWebExtension } from '@php-wasm/web';
import {
	compileBlueprintForExecution,
	isBlueprintBundle,
	resolveBlueprintV2WordPressSource,
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

		const requestedWordPressInstallMode = resolveWordPressInstallMode({
			shouldInstallWordPress,
			wordpressInstallMode,
		});
		const compiled = await compileBlueprintForExecution(blueprint, {
			progress: executionProgress,
			onStepCompleted: onBlueprintStepCompleted,
			onBlueprintValidated,
			corsProxy,
			gitAdditionalHeadersCallback,
			siteMode: isExistingSiteInstallMode(requestedWordPressInstallMode)
				? 'apply-to-existing-site'
				: 'create-new-site',
		});
		const runtimeConfiguration =
			compiled.version === 2
				? compiled.compiled.runtime
				: await resolveRuntimeConfiguration(compiled.declaration);
		const resolvedWordPressInstallMode =
			compiled.version === 2 &&
			compiled.declaration.wordpressVersion === 'none'
				? 'do-not-attempt-installing'
				: requestedWordPressInstallMode;
		const usesExistingWordPressFiles = isExistingSiteInstallMode(
			resolvedWordPressInstallMode
		);
		const wordPressZip =
			compiled.version === 2 &&
			resolvedWordPressInstallMode === 'download-and-install'
				? await resolveBlueprintV2WordPressSource(
						compiled.declaration,
						{
							progress: downloadProgress,
							corsProxy,
							gitAdditionalHeadersCallback,
							streamBundledFile: isBlueprintBundle(blueprint)
								? (path) => blueprint.read(path)
								: undefined,
						}
					)
				: undefined;
		const extensions: PHPWebExtension[] = runtimeConfiguration.intl
			? ['intl']
			: [];
		extensions.push(...(this.options.extensions || []));

		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			wordpressInstallMode: resolvedWordPressInstallMode,
			blueprint:
				compiled.version === 2 &&
				usesExistingWordPressFiles &&
				typeof compiled.declaration.wordpressVersion === 'object' &&
				compiled.declaration.wordpressVersion !== null &&
				'min' in compiled.declaration.wordpressVersion
					? {
							version: 2,
							wordpressVersion:
								compiled.declaration.wordpressVersion,
						}
					: undefined,
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion: runtimeConfiguration.wpVersion,
			wordPressZip,
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

/**
 * Indicates whether boot will reuse WordPress files supplied by the caller.
 *
 * The `if-needed` mode may initialize the database, but WordPress core still
 * comes from the mounted files rather than a fallback download.
 */
function isExistingSiteInstallMode(
	wordpressInstallMode: WordPressInstallMode
): boolean {
	return (
		wordpressInstallMode === 'install-from-existing-files' ||
		wordpressInstallMode === 'install-from-existing-files-if-needed'
	);
}
