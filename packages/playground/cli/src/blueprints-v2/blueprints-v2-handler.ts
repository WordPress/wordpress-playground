import { logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import {
	consumeAPI,
	isLegacyPHPVersion,
	type Pooled,
} from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import {
	BlueprintReflection,
	compileBlueprintV2,
	isBlueprintBundle,
	resolveRuntimeConfiguration,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	resolveWordPressRelease,
	type WordPressInstallMode,
} from '@wp-playground/wordpress';
import {
	cachedDownload,
	fetchSqliteIntegration,
} from '../blueprints-v1/download';
import type { PlaygroundCliBlueprintV2Worker } from './worker-thread-v2';
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
		return 'v2';
	}

	async bootWordPress(
		playground: Pooled<PlaygroundCliWorker>,
		workerPostInstallMountsPort: NodeMessagePort
	) {
		let wordPressZip: any = undefined;
		const v1PhpOnlyMode = await v1BlueprintRequestsPhpOnlyMode(
			this.args.blueprint
		);
		const wordpressInstallMode = resolveV2WordPressInstallMode(
			this.args,
			v1PhpOnlyMode
		);
		const effectiveBlueprint = await this.getEffectiveBlueprint();
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			effectiveBlueprint.declaration
		);
		assertCliSupportedPHPVersion(runtimeConfiguration.phpVersion);
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

			const wpDetails = await resolveWordPressRelease(
				runtimeConfiguration.wpVersion
			);
			wordPressZip = await cachedDownload(
				wpDetails.releaseUrl,
				`${wpDetails.version}.zip`,
				monitor
			);
			logger.debug(
				`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
			);
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
			playground as unknown as PlaygroundCliBlueprintV2Worker
		).bootWordPress(
			{
				phpVersion: runtimeConfiguration.phpVersion,
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
		const playground = consumeAPI<PlaygroundCliBlueprintV2Worker>(
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
					{
						...this.args,
						intl: runtimeConfiguration.intl,
					},
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

		const compiled = await compileBlueprintV2(blueprint.declaration, {
			progress: tracker,
			streamBundledFile: blueprint.streamBundledFile,
		});
		return {
			...compiled,
			declaration: blueprint.declaration,
		};
	}

	/**
	 * Returns a v2 declaration after applying CLI-level defaults.
	 *
	 * Bundled Blueprints keep a `streamBundledFile` callback because v2 lowering
	 * still needs the original archive to resolve bundled resources.
	 */
	private async getEffectiveBlueprint(additionalBlueprintSteps: any[] = []) {
		const resolvedBlueprint =
			this.args.blueprint || ({ version: 2 } as BlueprintV2Declaration);
		if (isBlueprintBundle(resolvedBlueprint)) {
			const blueprintBundle = resolvedBlueprint as BlueprintBundle;
			const reflection =
				await BlueprintReflection.create(blueprintBundle);
			return {
				declaration: applyCliOptionsToBlueprint(
					assertBlueprintV2Declaration(reflection.getDeclaration()),
					this.args,
					additionalBlueprintSteps
				),
				streamBundledFile: (path: string) => blueprintBundle.read(path),
			};
		}

		return {
			declaration: applyCliOptionsToBlueprint(
				assertBlueprintV2Declaration(resolvedBlueprint),
				this.args,
				additionalBlueprintSteps
			),
			streamBundledFile: undefined,
		};
	}
}

/**
 * Detects v1 PHP-only mode before upgrading declarations to v2.
 *
 * `preferredVersions.wp: false` is not a public v2 field, but the CLI must
 * still preserve it when a v1 declaration is migrated through the v2 compiler.
 */
async function v1BlueprintRequestsPhpOnlyMode(
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

/**
 * Maps Blueprint v2 CLI modes onto the worker's WordPress install modes.
 *
 * V1 PHP-only mode wins over CLI defaults because downloading WordPress would
 * change the semantics of a migrated `preferredVersions.wp: false` Blueprint.
 */
function resolveV2WordPressInstallMode(
	args: RunCLIArgs,
	v1PhpOnlyMode = false
): WordPressInstallMode {
	if (v1PhpOnlyMode) {
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

function assertCliSupportedPHPVersion(phpVersion: string) {
	if (phpVersion === 'next') {
		throw new Error(
			'Blueprint v2 phpVersion "next" is supported by the web runtime only and cannot be used by Playground CLI. Choose a stable PHP version such as 8.3.'
		);
	}
}

/**
 * Applies CLI defaults without mutating caller data.
 *
 * V1 declarations are upgraded first so the CLI has one lowering path while
 * preserving CLI defaults for PHP, WordPress, login, and appended steps.
 */
function applyCliOptionsToBlueprint(
	resolvedBlueprint: BlueprintV2Declaration,
	args: RunCLIArgs,
	additionalBlueprintSteps: any[] = []
) {
	const blueprint = { ...resolvedBlueprint } as any;

	// TODO: Decide whether explicit CLI flags should override Blueprint v2
	// runtime fields. For now, match the v1 CLI behavior: the Blueprint wins.
	if (blueprint.phpVersion === undefined) {
		blueprint.phpVersion = args.php || RecommendedPHPVersion;
	}
	if (blueprint.wordpressVersion === undefined) {
		blueprint.wordpressVersion = args.wp || 'latest';
	}
	const playgroundOptions =
		blueprint.applicationOptions?.['wordpress-playground'];
	if (playgroundOptions?.login === undefined && args.login === true) {
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

function assertBlueprintV2Declaration(
	declaration: unknown
): BlueprintV2Declaration {
	if ((declaration as BlueprintV2Declaration | undefined)?.version === 2) {
		return declaration as BlueprintV2Declaration;
	}
	throw new Error(
		'The native Blueprint v2 handler requires a Blueprint v2 declaration.'
	);
}
