import { logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import { consumeAPI } from '@php-wasm/universal';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import {
	compileBlueprintV1,
	isBlueprintBundle,
	resolveRuntimeConfiguration,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion, zipDirectory } from '@wp-playground/common';
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
	type RunCLIArgs,
	type SpawnedWorker,
	type WorkerType,
	mergeDefinedConstants,
} from '../run-cli';
import type { CLIOutput } from '../cli-output';

/**
 * Boots Playground CLI workers using Blueprint version 1.
 *
 * Progress tracking, downloads, steps, and all other features are
 * implemented in TypeScript and orchestrated by this class.
 */
export class BlueprintsV1Handler {
	private siteUrl: string;
	private processIdSpaceLength: number;
	private args: RunCLIArgs;
	private cliOutput: CLIOutput;

	constructor(
		args: RunCLIArgs,
		options: {
			siteUrl: string;
			processIdSpaceLength: number;
			cliOutput: CLIOutput;
		}
	) {
		this.args = args;
		this.siteUrl = options.siteUrl;
		this.processIdSpaceLength = options.processIdSpaceLength;
		this.cliOutput = options.cliOutput;
	}

	getWorkerType(): WorkerType {
		return 'v1';
	}

	async bootAndSetUpInitialPlayground(
		phpPort: NodeMessagePort,
		fileLockManagerPort: NodeMessagePort,
		nativeInternalDirPath: string
	) {
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

			wpDetails = await resolveWordPressRelease(this.args.wp);
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
			sqliteIntegrationPluginZip = await fetchSqliteIntegration(monitor);
		}

		const followSymlinks = this.args.followSymlinks === true;
		const trace = this.args.experimentalTrace === true;

		const mountsBeforeWpInstall = this.args['mount-before-install'] || [];
		const mountsAfterWpInstall = this.args.mount || [];

		const playground = consumeAPI<PlaygroundCliBlueprintV1Worker>(phpPort);

		// Comlink communication proxy
		await playground.isConnected();

		this.cliOutput.updateProgress('Booting WordPress');

		const runtimeConfiguration = await resolveRuntimeConfiguration(
			this.getEffectiveBlueprint()
		);

		await playground.useFileLockManager(fileLockManagerPort);
		await playground.bootAndSetUpInitialWorker({
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion: runtimeConfiguration.wpVersion,
			siteUrl: this.siteUrl,
			mountsBeforeWpInstall,
			mountsAfterWpInstall,
			wordpressInstallMode:
				this.args.wordpressInstallMode || 'download-and-install',
			wordPressZip: wordPressZip && (await wordPressZip!.arrayBuffer()),
			sqliteIntegrationPluginZip:
				await sqliteIntegrationPluginZip?.arrayBuffer(),
			firstProcessId: 0,
			processIdSpaceLength: this.processIdSpaceLength,
			followSymlinks,
			trace,
			internalCookieStore: this.args.internalCookieStore,
			withIntl: this.args.intl,
			withRedis: this.args.redis,
			// We do not enable Xdebug by default for the initial worker
			// because we do not imagine users expect to hit breakpoints
			// until Playground has fully booted.
			// TODO: Consider supporting Xdebug for the initial worker via a dedicated flag.
			withXdebug: false,
			nativeInternalDirPath,
			constants: mergeDefinedConstants(this.args),
		});

		if (
			preinstalledWpContentPath &&
			!this.args['mount-before-install'] &&
			!fs.existsSync(preinstalledWpContentPath)
		) {
			this.cliOutput.updateProgress('Caching WordPress for next boot');
			fs.writeFileSync(
				preinstalledWpContentPath,
				(await zipDirectory(playground, '/wordpress'))!
			);
		}

		return playground;
	}

	async bootPlayground({
		worker,
		fileLockManagerPort,
		firstProcessId,
		nativeInternalDirPath,
	}: {
		worker: SpawnedWorker;
		fileLockManagerPort: NodeMessagePort;
		firstProcessId: number;
		nativeInternalDirPath: string;
	}) {
		const playground = consumeAPI<PlaygroundCliBlueprintV1Worker>(
			worker.phpPort
		);

		await playground.isConnected();
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			this.getEffectiveBlueprint()
		);
		await playground.useFileLockManager(fileLockManagerPort);
		await playground.bootWorker({
			phpVersion: runtimeConfiguration.phpVersion,
			siteUrl: this.siteUrl,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args['mount'] || [],
			firstProcessId,
			processIdSpaceLength: this.processIdSpaceLength,
			followSymlinks: this.args.followSymlinks === true,
			trace: this.args.experimentalTrace === true,
			// @TODO: Move this to the request handler or else every worker
			//        will have a separate cookie store.
			internalCookieStore: this.args.internalCookieStore,
			withIntl: this.args.intl,
			withRedis: this.args.redis,
			withXdebug: !!this.args.xdebug,
			nativeInternalDirPath,
			constants: mergeDefinedConstants(this.args),
		});
		await playground.isReady();
		return playground;
	}

	async compileInputBlueprint(additionalBlueprintSteps: any[]) {
		const blueprint = this.getEffectiveBlueprint();

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

		return await compileBlueprintV1(blueprint as BlueprintV1Declaration, {
			progress: tracker,
			additionalSteps: additionalBlueprintSteps,
		});
	}

	private getEffectiveBlueprint() {
		const resolvedBlueprint = this.args.blueprint as BlueprintV1Declaration;
		/**
		 * @TODO This looks similar to the resolveBlueprint() call in the website package:
		 * 	     https://github.com/WordPress/wordpress-playground/blob/ce586059e5885d185376184fdd2f52335cca32b0/packages/playground/website/src/main.tsx#L41
		 *
		 * 		 Also the Blueprint Builder tool does something similar.
		 *       Perhaps all these cases could be handled by the same function?
		 */
		return isBlueprintBundle(resolvedBlueprint)
			? resolvedBlueprint
			: {
					login: this.args.login,
					...(resolvedBlueprint || {}),
					preferredVersions: {
						php:
							this.args.php ??
							resolvedBlueprint?.preferredVersions?.php ??
							RecommendedPHPVersion,
						wp:
							this.args.wp ??
							resolvedBlueprint?.preferredVersions?.wp ??
							'latest',
						...(resolvedBlueprint?.preferredVersions || {}),
					},
				};
	}
}
