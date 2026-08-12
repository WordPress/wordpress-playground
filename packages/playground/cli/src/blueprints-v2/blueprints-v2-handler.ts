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
	assertBlueprintV2WordPressVersionCompatibility,
	BlueprintReflection,
	compileBlueprintV2,
	isBlueprintBundle,
	resolveBlueprintV2WordPressSource,
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
	private wordpressInstallModePromise?: Promise<WordPressInstallMode>;

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
		let wordPressZip: File | undefined;
		const wordpressInstallMode = await this.getWordPressInstallMode();
		const effectiveBlueprint = await this.getEffectiveBlueprint();
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			effectiveBlueprint.declaration,
			{
				siteMode: isV2ExistingSiteInstallMode(wordpressInstallMode)
					? 'apply-to-existing-site'
					: 'create-new-site',
			}
		);
		assertCliSupportedPHPVersion(runtimeConfiguration.phpVersion);
		if (wordpressInstallMode === 'download-and-install') {
			wordPressZip = await resolveBlueprintV2WordPressSource(
				effectiveBlueprint.declaration,
				{
					streamBundledFile: effectiveBlueprint.streamBundledFile,
				}
			);
			if (!wordPressZip) {
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
		}

		if (isV2ExistingSiteInstallMode(wordpressInstallMode)) {
			const installedVersion = await playground.run({
				code: `<?php
					if (file_exists('/wordpress/wp-includes/version.php')) {
						require '/wordpress/wp-includes/version.php';
						echo $wp_version;
					}
				`,
			});
			const installedVersionString = installedVersion.text.trim();
			if (installedVersionString) {
				await assertBlueprintV2WordPressVersionCompatibility(
					effectiveBlueprint.declaration,
					installedVersionString
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
		const wordpressInstallMode = await this.getWordPressInstallMode();
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			(await this.getEffectiveBlueprint()).declaration,
			{
				siteMode: isV2ExistingSiteInstallMode(wordpressInstallMode)
					? 'apply-to-existing-site'
					: 'create-new-site',
			}
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
		const wordpressInstallMode = await this.getWordPressInstallMode();

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
			siteMode: isV2ExistingSiteInstallMode(wordpressInstallMode)
				? 'apply-to-existing-site'
				: 'create-new-site',
		});
		return {
			...compiled,
			declaration: blueprint.declaration,
		};
	}

	/**
	 * Resolves the worker install mode, including migrated v1 PHP-only sites.
	 */
	private getWordPressInstallMode(): Promise<WordPressInstallMode> {
		this.wordpressInstallModePromise ??= blueprintRequestsPhpOnlyMode(
			this.args.blueprint
		).then((phpOnlyMode) =>
			resolveV2WordPressInstallMode(this.args, phpOnlyMode)
		);
		return this.wordpressInstallModePromise;
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
 * Detects PHP-only mode before upgrading v1 declarations to v2.
 *
 * V1 uses `preferredVersions.wp: false`; v2 uses `wordpressVersion: "none"`.
 */
async function blueprintRequestsPhpOnlyMode(
	blueprint: RunCLIArgs['blueprint']
) {
	if (!blueprint) {
		return false;
	}
	const reflection = await BlueprintReflection.create(blueprint as any);
	const declaration = reflection.getDeclaration();
	return reflection.getVersion() === 1
		? (declaration as any).preferredVersions?.wp === false
		: (declaration as BlueprintV2Declaration).wordpressVersion === 'none';
}

/**
 * Maps Blueprint v2 CLI modes onto the worker's WordPress install modes.
 *
 * A PHP-only Blueprint wins over CLI defaults because downloading WordPress
 * would contradict `wordpressVersion: "none"`.
 */
function resolveV2WordPressInstallMode(
	args: RunCLIArgs,
	phpOnlyMode = false
): WordPressInstallMode {
	if (phpOnlyMode) {
		if (args.mode && args.mode !== 'mount-only') {
			throw new Error(
				'Conflicting options: WordPress was requested, but the Blueprint sets `wordpressVersion: "none"`. Pick one.'
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

/**
 * Indicates whether boot will reuse WordPress files supplied by the caller.
 *
 * The `if-needed` variant may initialize the database, but it never downloads
 * WordPress core as a fallback when the mounted files are absent.
 */
function isV2ExistingSiteInstallMode(
	wordpressInstallMode: WordPressInstallMode
): boolean {
	return (
		wordpressInstallMode === 'install-from-existing-files' ||
		wordpressInstallMode === 'install-from-existing-files-if-needed'
	);
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
