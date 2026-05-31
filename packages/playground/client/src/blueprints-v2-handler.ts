import type { ProgressTracker } from '@php-wasm/progress';
import type { PlaygroundClient, StartPlaygroundOptions } from '.';
import {
	collectPhpLogs,
	logger,
} from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';
import {
	BlueprintReflection,
	compileBlueprintV2,
	hasBlueprintV2WordPressZipReference,
	resolveBlueprintV2WordPressSource,
	resolveRuntimeConfiguration,
	runBlueprintV2Steps,
} from '@wp-playground/blueprints';
import type { PHPWebExtension } from '@php-wasm/web';

export class BlueprintsV2Handler {
	private readonly options: StartPlaygroundOptions;

	constructor(options: StartPlaygroundOptions) {
		this.options = options;
	}

	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			blueprint = { version: 2 },
			onBlueprintValidated,
			onBlueprintStepCompleted,
			onClientConnected,
			corsProxy,
			gitAdditionalHeadersCallback,
			mounts,
			sapiName,
			scope,
			sqliteDriverVersion,
			wordpressInstallMode,
			shouldInstallWordPress,
			pathAliases,
			disableProgressBar,
		} = this.options;
		const executionProgress = progressTracker.stage(0.5);
		const downloadProgress = progressTracker.stage();

		const playground = consumeAPI<PlaygroundClient>(
			iframe.contentWindow!,
			iframe.ownerDocument!.defaultView!
		) as PlaygroundClient;
		await playground.isConnected();
		if (!disableProgressBar) {
			progressTracker.pipe(playground);
		}

		const runtimeConfiguration =
			await resolveRuntimeConfiguration(blueprint);
		const declarativeOptOut =
			await blueprintRequestsNoWordPress(blueprint);
		const resolvedWordPressInstallMode =
			wordpressInstallMode ??
			(declarativeOptOut
				? 'do-not-attempt-installing'
				: shouldInstallWordPress === false
					? 'install-from-existing-files-if-needed'
					: 'download-and-install');
		if (
			declarativeOptOut &&
			(shouldInstallWordPress === true ||
				(wordpressInstallMode !== undefined &&
					wordpressInstallMode !== 'do-not-attempt-installing'))
		) {
			throw new Error(
				'Conflicting options: WordPress was requested, ' +
					'but the Blueprint sets ' +
					'`preferredVersions.wp: false`. Pick one.'
			);
		}
		if (
			(await hasBlueprintV2WordPressZipReference(blueprint)) &&
			resolvedWordPressInstallMode !== 'download-and-install'
		) {
			throw new Error(
				'Blueprint v2 wordpressVersion ZIP references can only be used when creating a new site.'
			);
		}
		const wordpressSource = await resolveBlueprintV2WordPressSource(
			blueprint,
			{
				corsProxy,
				gitAdditionalHeadersCallback,
			}
		);
		const extensions: PHPWebExtension[] = runtimeConfiguration.intl
			? ['intl']
			: [];
		extensions.push(...(this.options.extensions || []));

		await playground.onDownloadProgress(downloadProgress.loadingListener);
		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			wordpressInstallMode: resolvedWordPressInstallMode,
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion: wordpressSource.wpVersion,
			wordPressZip:
				wordpressSource.wordPressZip &&
				(await wordpressSource.wordPressZip.arrayBuffer()),
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

		const compiled = await compileBlueprintV2(blueprint, {
			progress: executionProgress,
			onStepCompleted: onBlueprintStepCompleted,
			onBlueprintValidated,
			corsProxy,
			gitAdditionalHeadersCallback,
		});
		await runBlueprintV2Steps(compiled, playground);

		return playground;
	}
}

async function blueprintRequestsNoWordPress(
	blueprint: StartPlaygroundOptions['blueprint']
) {
	if (!blueprint) {
		return false;
	}
	const reflection = await BlueprintReflection.create(blueprint);
	return (
		reflection.getVersion() === 1 &&
		(reflection.getDeclaration() as any).preferredVersions?.wp === false
	);
}
