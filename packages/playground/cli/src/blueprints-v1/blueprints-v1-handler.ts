import { logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import {
	consumeAPI,
	isLegacyPHPVersion,
	type Pooled,
	type UniversalPHP,
} from '@php-wasm/universal';
import type { BlueprintV1 } from '@wp-playground/blueprints';
import {
	compileBlueprintV1,
	getBlueprintDeclaration,
	isBlueprintBundle,
	mergeBlueprintVersions,
	resolveRuntimeConfiguration,
} from '@wp-playground/blueprints';
import { zipDirectory } from '@wp-playground/common';
import { InMemoryFilesystem, OverlayFilesystem } from '@wp-playground/storage';
import fs from 'fs';
import path from 'path';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import type { PlaygroundCliBlueprintV1Worker } from './worker-thread-v1';
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
 * Boots Playground CLI workers using Blueprint version 1.
 *
 * Progress tracking, downloads, steps, and all other features are
 * implemented in TypeScript and orchestrated by this class.
 */
export class BlueprintsV1Handler {
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
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			await this.getEffectiveBlueprint()
		);
		let wpDetails: any = undefined;
		let wordPressZip: any = undefined;
		let preinstalledWpContentPath: string | undefined = undefined;
		// @TODO: Rename to FetchProgressMonitor. There's nothing Emscripten
		// about that class anymore.
		const monitor = new EmscriptenDownloadMonitor();
		if (this.args.wordpressInstallMode === 'download-and-install') {
			let progressReached100 = false;
			monitor.addEventListener('progress', ((
				e: CustomEvent<ProgressEvent & { finished: boolean }>
			) => {
				if (progressReached100) {
					return;
				}

				// @TODO Every progress bar will want percentages. The
				//       download monitor should just provide that.
				const { loaded, total } = e.detail;
				// Use floor() so we don't report 100% until truly there.
				const percentProgress = Math.floor(
					Math.min(100, (100 * loaded) / total)
				);
				progressReached100 = percentProgress === 100;

				this.cliOutput.updateProgress(
					'Downloading WordPress',
					percentProgress
				);
			}) as any);

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

		let sqliteIntegrationPluginZip;
		if (this.args.skipSqliteSetup) {
			logger.debug(`Skipping SQLite integration plugin setup...`);
			sqliteIntegrationPluginZip = undefined;
		} else {
			this.cliOutput.updateProgress('Preparing SQLite database');
			// Use pre-patched v3.0.0-rc.3 for legacy PHP (closures replaced
			// with named functions, PHP 5.2 polyfills added offline).
			const phpVersion = runtimeConfiguration.phpVersion;
			const isLegacyPhp = isLegacyPHPVersion(phpVersion);
			const sqliteVersion = isLegacyPhp ? 'v3.0.0-rc.3-php52' : 'trunk';
			sqliteIntegrationPluginZip =
				await fetchSqliteIntegration(sqliteVersion);
		}

		this.cliOutput.updateProgress('Booting WordPress');

		// TODO: Fix this type issue that requires the cast to unknown
		await (
			playground as unknown as PlaygroundCliBlueprintV1Worker
		).bootWordPress(
			{
				phpVersion: runtimeConfiguration.phpVersion,
				wpVersion: runtimeConfiguration.wpVersion,
				siteUrl: this.siteUrl,
				wordpressInstallMode:
					this.args.wordpressInstallMode || 'download-and-install',
				wordPressZip:
					wordPressZip && (await wordPressZip!.arrayBuffer()),
				sqliteIntegrationPluginZip:
					await sqliteIntegrationPluginZip?.arrayBuffer(),
				constants: mergeDefinedConstants(this.args),
			},
			workerPostInstallMountsPort
		);

		if (
			preinstalledWpContentPath &&
			!this.args['mount-before-install'] &&
			!fs.existsSync(preinstalledWpContentPath)
		) {
			this.cliOutput.updateProgress('Caching WordPress for next boot');
			fs.writeFileSync(
				preinstalledWpContentPath,
				// Comlink proxy is not assignable to UniversalPHP but
				// proxies all method calls transparently at runtime.
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
			await this.getEffectiveBlueprint()
		);
		await playground.useFileLockManager(fileLockManagerPort);
		await playground.bootRequestHandler({
			phpVersion: runtimeConfiguration.phpVersion,
			siteUrl: this.siteUrl,
			phpIniEntries: this.args['php-ini'],
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args['mount'] || [],
			processId: worker.processId,
			followSymlinks: this.args.followSymlinks === true,
			trace: this.args.experimentalTrace === true,
			extensions: cliExtensionArgsToExtensionsArray(this.args),
			nativeInternalDirPath,
			pathAliases: this.args.pathAliases,
		});
		await playground.isReady();
		return playground;
	}

	async compileInputBlueprint(additionalBlueprintSteps: any[]) {
		const blueprint = await this.getEffectiveBlueprint();

		const tracker = new ProgressTracker();
		let lastCaption = '';
		let progressReached100 = false;
		tracker.addEventListener('progress', (e: any) => {
			if (progressReached100) {
				return;
			}
			progressReached100 = e.detail.progress === 100;

			// Use floor() so we don't report 100% until truly there.
			const progressInteger = Math.floor(e.detail.progress);
			lastCaption =
				e.detail.caption || lastCaption || 'Running Blueprint';
			this.cliOutput.updateProgress(lastCaption.trim(), progressInteger);
		});

		return await compileBlueprintV1(blueprint, {
			progress: tracker,
			additionalSteps: additionalBlueprintSteps,
		});
	}

	/**
	 * Applies CLI version overrides and a default login setting to the input Blueprint.
	 * Bundles retain their resource filesystem and access restrictions beneath an overlaid
	 * declaration. PHP-only Blueprints bypass these overrides, matching the website.
	 */
	private async getEffectiveBlueprint(): Promise<BlueprintV1> {
		const resolvedBlueprint = (this.args.blueprint || {}) as BlueprintV1;
		const declaration = await getBlueprintDeclaration(resolvedBlueprint);
		if (declaration.preferredVersions?.wp === false) {
			return resolvedBlueprint;
		}
		const blueprint = mergeBlueprintVersions(
			{
				login: this.args.login,
				...declaration,
			},
			{
				php: this.args.php,
				wp: this.args.wp,
			}
		);
		if (isBlueprintBundle(resolvedBlueprint)) {
			return new OverlayFilesystem([
				new InMemoryFilesystem({
					'blueprint.json': JSON.stringify(blueprint),
				}),
				resolvedBlueprint,
			]);
		}
		return blueprint;
	}
}
