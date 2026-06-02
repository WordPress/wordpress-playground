import { logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import {
	consumeAPI,
	isLegacyPHPVersion,
	type Pooled,
	type UniversalPHP,
} from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintV1Declaration,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import {
	BlueprintReflection,
	compileBlueprintV2,
	hasBlueprintV2WordPressZipReference,
	isBlueprintBundle,
	resolveBlueprintV2WordPressSource,
	resolveRuntimeConfiguration,
	upgradeBlueprintV1ToV2,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion, zipDirectory } from '@wp-playground/common';
import fs from 'fs';
import path from 'path';
import {
	resolveWordPressRelease,
	type WordPressInstallMode,
} from '@wp-playground/wordpress';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from '../blueprints-v1/download';
import type { PlaygroundCliBlueprintV1Worker } from '../blueprints-v1/worker-thread-v1';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import {
	type PlaygroundCliWorker,
	type RunCLIArgs,
	type SpawnedWorker,
	type WorkerType,
	mergeDefinedConstants,
} from '../run-cli';
import type { CLIOutput } from '../cli-output';
import { cliExtensionArgsToExtensionsArray } from '../php-extensions';

/**
 * Boots Playground CLI workers using the native TypeScript Blueprint v2
 * compiler and step runtime.
 */
export class BlueprintsV2Handler {
	private siteUrl: string;
	private args: RunCLIArgs;
	private cliOutput: CLIOutput;

	constructor(
		args: RunCLIArgs,
		options: {
			siteUrl: string;
			cliOutput: CLIOutput;
		}
	) {
		this.args = args;
		this.siteUrl = options.siteUrl;
		this.cliOutput = options.cliOutput;
	}

	getWorkerType(): WorkerType {
		return 'v1';
	}

	async bootWordPress(
		playground: Pooled<PlaygroundCliWorker>,
		workerPostInstallMountsPort: NodeMessagePort
	) {
		let wpDetails: any = undefined;
		let wordPressZip: any = undefined;
		let preinstalledWpContentPath: string | undefined = undefined;
		const legacyBlueprintSkipsWordPress =
			await blueprintRequestsNoWordPress(this.args.blueprint);
		const wordpressInstallMode = resolveV2WordPressInstallMode(
			this.args,
			legacyBlueprintSkipsWordPress
		);
		const effectiveBlueprint = await this.getEffectiveBlueprint();
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			effectiveBlueprint.declaration
		);
		assertCliSupportedPHPVersion(runtimeConfiguration.phpVersion);
		if (
			(await hasBlueprintV2WordPressZipReference(
				effectiveBlueprint.declaration
			)) &&
			wordpressInstallMode !== 'download-and-install'
		) {
			throw new Error(
				'Blueprint v2 wordpressVersion ZIP references can only be used when creating a new site.'
			);
		}
		const wordpressSource = await resolveBlueprintV2WordPressSource(
			effectiveBlueprint.declaration,
			{
				streamBundledFile: effectiveBlueprint.streamBundledFile,
			}
		);
		if (wordpressInstallMode === 'download-and-install') {
			const monitor = new EmscriptenDownloadMonitor();
			let progressReached100 = false;
			monitor.addEventListener('progress', ((
				e: CustomEvent<ProgressEvent & { finished: boolean }>
			) => {
				if (progressReached100) {
					return;
				}
				const { loaded, total } = e.detail;
				const percentProgress = Math.floor(
					Math.min(100, (100 * loaded) / total)
				);
				progressReached100 = percentProgress === 100;
				this.cliOutput.updateProgress(
					'Downloading WordPress',
					percentProgress
				);
			}) as any);

			if (wordpressSource.wordPressZip) {
				wordPressZip = wordpressSource.wordPressZip;
			} else {
				wpDetails = await resolveWordPressRelease(
					runtimeConfiguration.wpVersion
				);
				preinstalledWpContentPath = path.join(
					CACHE_FOLDER,
					`prebuilt-wp-content-for-wp-${wpDetails.version}.zip`
				);
				wordPressZip = fs.existsSync(preinstalledWpContentPath)
					? readAsFile(preinstalledWpContentPath)
					: await cachedDownload(
							wpDetails.releaseUrl,
							`${wpDetails.version}.zip`,
							monitor
						);
				logger.debug(
					`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
				);
			}
		}

		let sqliteIntegrationPluginZip;
		if (
			this.args.skipSqliteSetup ||
			wordpressInstallMode === 'do-not-attempt-installing'
		) {
			logger.debug(`Skipping SQLite integration plugin setup...`);
			sqliteIntegrationPluginZip = undefined;
		} else {
			this.cliOutput.updateProgress('Preparing SQLite database');
			const isLegacyPhp = isLegacyPHPVersion(
				runtimeConfiguration.phpVersion
			);
			const sqliteVersion = isLegacyPhp ? 'v3.0.0-rc.3-php52' : 'trunk';
			sqliteIntegrationPluginZip =
				await fetchSqliteIntegration(sqliteVersion);
		}

		this.cliOutput.updateProgress('Booting WordPress');

		await (
			playground as unknown as PlaygroundCliBlueprintV1Worker
		).bootWordPress(
			{
				phpVersion: runtimeConfiguration.phpVersion,
				wpVersion: wordpressSource.wpVersion,
				siteUrl: this.siteUrl,
				wordpressInstallMode,
				networking: runtimeConfiguration.networking,
				wordPressZip:
					wordPressZip && (await wordPressZip.arrayBuffer()),
				sqliteIntegrationPluginZip:
					await sqliteIntegrationPluginZip?.arrayBuffer(),
				constants: mergeDefinedConstantsForPHPVersion(
					this.args,
					runtimeConfiguration.phpVersion
				),
			},
			workerPostInstallMountsPort
		);

		if (
			preinstalledWpContentPath &&
			!this.args['mount-before-install']?.length &&
			!fs.existsSync(preinstalledWpContentPath)
		) {
			this.cliOutput.updateProgress('Caching WordPress for next boot');
			fs.writeFileSync(
				preinstalledWpContentPath,
				(await zipDirectory(
					playground as unknown as UniversalPHP,
					'/wordpress'
				))!
			);
		}

		return playground;
	}

	async bootRequestHandler({
		worker,
		fileLockManagerPort,
		nativeInternalDirPath,
	}: {
		worker: SpawnedWorker;
		fileLockManagerPort: NodeMessagePort;
		nativeInternalDirPath: string;
	}) {
		const playground = consumeAPI<PlaygroundCliBlueprintV1Worker>(
			worker.phpPort
		);

		await playground.isConnected();
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			(await this.getEffectiveBlueprint()).declaration
		);
		assertCliSupportedPHPVersion(runtimeConfiguration.phpVersion);
		await playground.useFileLockManager(fileLockManagerPort);
		await playground.bootRequestHandler({
			phpVersion: runtimeConfiguration.phpVersion,
			siteUrl: this.siteUrl,
			networking: runtimeConfiguration.networking,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args.mount || [],
			processId: worker.processId,
			followSymlinks: this.args.followSymlinks === true,
			trace: this.args.experimentalTrace === true,
			extensions: cliExtensionArgsToExtensionsArray(
				filterExtensionArgsForPHPVersion(
					this.args,
					runtimeConfiguration.phpVersion
				)
			),
			nativeInternalDirPath,
			pathAliases: this.args.pathAliases,
		});
		await playground.isReady();
		return playground;
	}

	async compileInputBlueprint(additionalBlueprintSteps: any[]) {
		const blueprint = await this.getEffectiveBlueprint(
			additionalBlueprintSteps
		);

		const tracker = new ProgressTracker();
		let lastCaption = '';
		let progressReached100 = false;
		tracker.addEventListener('progress', (e: any) => {
			if (progressReached100) {
				return;
			}
			progressReached100 = e.detail.progress === 100;
			const progressInteger = Math.floor(e.detail.progress);
			lastCaption =
				e.detail.caption || lastCaption || 'Running Blueprint';
			this.cliOutput.updateProgress(lastCaption.trim(), progressInteger);
		});

		return await compileBlueprintV2(blueprint.declaration, {
			progress: tracker,
			streamBundledFile: blueprint.streamBundledFile,
		});
	}

	private async getEffectiveBlueprint(additionalBlueprintSteps: any[] = []) {
		const resolvedBlueprint =
			this.args.blueprint || ({ version: 2 } as BlueprintV2Declaration);
		if (isBlueprintBundle(resolvedBlueprint)) {
			const reflection = await BlueprintReflection.create(
				resolvedBlueprint as BlueprintBundle
			);
			return {
				declaration: applyCliOptionsToBlueprint(
					reflection.getDeclaration() as
						| BlueprintV1Declaration
						| BlueprintV2Declaration,
					this.args,
					additionalBlueprintSteps
				),
				streamBundledFile: (resolvedBlueprint as BlueprintBundle).read,
			};
		}

		return {
			declaration: applyCliOptionsToBlueprint(
				resolvedBlueprint as
					| BlueprintV1Declaration
					| BlueprintV2Declaration,
				this.args,
				additionalBlueprintSteps
			),
			streamBundledFile: undefined,
		};
	}
}

function assertCliSupportedPHPVersion(phpVersion: string) {
	if (phpVersion === 'next') {
		throw new Error(
			'Blueprint v2 phpVersion "next" is supported by the web runtime only and cannot be used by Playground CLI. Choose a stable PHP version such as 8.3.'
		);
	}
}

function applyCliOptionsToBlueprint(
	resolvedBlueprint: BlueprintV1Declaration | BlueprintV2Declaration,
	args: RunCLIArgs,
	additionalBlueprintSteps: any[] = []
) {
	const blueprint =
		(resolvedBlueprint as any).version === 2
			? ({ ...(resolvedBlueprint as BlueprintV2Declaration) } as any)
			: (upgradeBlueprintV1ToV2(
					resolvedBlueprint as BlueprintV1Declaration
				) as any);

	if (args.php && cliOptionWasProvided(args, 'php')) {
		blueprint.phpVersion = args.php;
	} else if (blueprint.phpVersion === undefined) {
		blueprint.phpVersion = args.php || RecommendedPHPVersion;
	}
	if (args.wp && cliOptionWasProvided(args, 'wp')) {
		blueprint.wordpressVersion = args.wp;
	} else if (blueprint.wordpressVersion === undefined) {
		blueprint.wordpressVersion = args.wp || 'latest';
	}
	const playgroundOptions =
		blueprint.applicationOptions?.['wordpress-playground'];
	const shouldApplyDefaultStartLogin =
		(args.originalCommand || args.command) === 'start' &&
		args.login === true &&
		playgroundOptions?.login === undefined;
	if (cliOptionWasProvided(args, 'login') || shouldApplyDefaultStartLogin) {
		blueprint.applicationOptions = {
			...(blueprint.applicationOptions || {}),
			'wordpress-playground': {
				...(playgroundOptions || {}),
				login: args.login === true,
			},
		};
	}
	if (additionalBlueprintSteps.length > 0) {
		blueprint.additionalStepsAfterExecution = [
			...(blueprint.additionalStepsAfterExecution || []),
			...normalizeAdditionalBlueprintSteps(additionalBlueprintSteps),
		];
	}
	return blueprint as BlueprintV2Declaration;
}

function resolveV2WordPressInstallMode(
	args: RunCLIArgs,
	legacyBlueprintSkipsWordPress = false
): WordPressInstallMode {
	if (legacyBlueprintSkipsWordPress) {
		if (args.mode && args.mode !== 'mount-only') {
			throw new Error(
				'Conflicting options: WordPress was requested, but the Blueprint sets `preferredVersions.wp: false`. Pick one.'
			);
		}
		if (
			!args.mode &&
			args.wordpressInstallMode &&
			args.wordpressInstallMode !== 'do-not-attempt-installing'
		) {
			throw new Error(
				'Conflicting options: WordPress was requested, but the Blueprint sets `preferredVersions.wp: false`. Pick one.'
			);
		}
		return 'do-not-attempt-installing';
	}
	switch (args.mode) {
		case 'apply-to-existing-site':
			return 'install-from-existing-files-if-needed';
		case 'mount-only':
			return 'do-not-attempt-installing';
		case 'create-new-site':
			return 'download-and-install';
	}
	return args.wordpressInstallMode || 'download-and-install';
}

async function blueprintRequestsNoWordPress(
	blueprint: RunCLIArgs['blueprint']
) {
	if (!blueprint) {
		return false;
	}
	const reflection = await BlueprintReflection.create(blueprint as any);
	return (
		reflection.getVersion() === 1 &&
		(reflection.getDeclaration() as any).preferredVersions?.wp === false
	);
}

function normalizeAdditionalBlueprintSteps(steps: any[]) {
	return steps.flatMap((step) => {
		if (step?.step === 'activateTheme' && step.themeFolderName) {
			return [
				{
					step: 'activateTheme',
					themeDirectoryName: step.themeFolderName,
				},
			];
		}
		return [step];
	});
}

function cliOptionWasProvided(
	args: RunCLIArgs,
	option: 'php' | 'wp' | 'login'
) {
	if (args.cliProvidedOptions) {
		return args.cliProvidedOptions[option] === true;
	}
	return args[option] !== undefined;
}

function filterExtensionArgsForPHPVersion(
	args: RunCLIArgs,
	phpVersion: string | undefined
): RunCLIArgs {
	if (!isLegacyPHPVersion(phpVersion)) {
		return args;
	}
	return {
		...args,
		intl: false,
		redis: false,
		memcached: false,
		xdebug: false,
	};
}

export { runBlueprintV2Steps } from '@wp-playground/blueprints';

function mergeDefinedConstantsForPHPVersion(
	args: RunCLIArgs,
	phpVersion: string | undefined
) {
	const defineBool = { ...(args['define-bool'] || {}) };
	if (isLegacyPHPVersion(phpVersion)) {
		for (const name of args.defaultedDebugConstants || []) {
			delete defineBool[name];
		}
	}
	return mergeDefinedConstants({
		...args,
		'define-bool': defineBool,
	});
}
