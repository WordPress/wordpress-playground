import { logger } from '@php-wasm/logger';
// TODO: Wire up download progress tracking with initial worker
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import { consumeAPI, exposeAPI, type NodeProcess } from '@php-wasm/universal';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import {
	compileBlueprintV1,
	isBlueprintBundle,
	resolveRuntimeConfiguration,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/common';
import type { PlaygroundCliBlueprintV1Worker } from './worker-thread-v1';
import {
	LogVerbosity,
	type SpawnedWorker,
	type WorkerType,
	type RunCLIArgsWithResolvedRequiredArgs,
} from '../run-cli';
import { shouldRenderProgress } from '../utils/progress';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import {
	CACHE_FOLDER,
	cachedDownload,
	fetchSqliteIntegration,
	readAsFile,
} from './download';
import path from 'path';
import fs from 'fs';

/**
 * Boots Playground CLI workers using Blueprint version 1.
 *
 * Progress tracking, downloads, steps, and all other features are
 * implemented in TypeScript and orchestrated by this class.
 */
export class BlueprintsV1Handler {
	private lastProgressMessage = '';

	private siteUrl: string;
	private processIdSpaceLength: number;
	private args: RunCLIArgsWithResolvedRequiredArgs;

	constructor(
		args: RunCLIArgsWithResolvedRequiredArgs,
		options: {
			siteUrl: string;
			processIdSpaceLength: number;
		}
	) {
		this.args = args;
		this.siteUrl = options.siteUrl;
		this.processIdSpaceLength = options.processIdSpaceLength;
	}

	getWorkerType(): WorkerType {
		return 'v1';
	}

	async bootWordPress(
		workerProcess: SpawnedWorker,
		onWordPressInstalled: () => Promise<void>
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

				this.writeProgressUpdate(
					process.stdout,
					`Downloading WordPress ${percentProgress}%...`,
					progressReached100
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
			logger.log(
				`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
			);
		}

		let sqliteIntegrationPluginZip;
		if (this.args.skipSqliteSetup) {
			logger.log(`Skipping SQLite integration plugin setup...`);
			sqliteIntegrationPluginZip = undefined;
		} else {
			logger.log(`Fetching SQLite integration plugin...`);
			sqliteIntegrationPluginZip = await fetchSqliteIntegration(monitor);
		}

		// TODO: Fix this type error.
		// @ts-ignore
		const playground =
			// TODO: Fix this type error.
			// @ts-ignore
			consumeAPI<PlaygroundCliBlueprintV1Worker>(workerProcess);

		// Comlink communication proxy
		await playground.isConnected();

		logger.log(`Booting WordPress...`);

		// TODO: Fix this need to cast due to type error.
		// @ts-ignore
		exposeAPI(
			onWordPressInstalled,
			undefined,
			workerProcess as NodeProcess
		);
		await playground.bootWordPress({
			siteUrl: this.siteUrl,
			wordpressInstallMode:
				this.args.wordpressInstallMode || 'download-and-install',
			wordPressZip: await wordPressZip?.arrayBuffer(),
			sqliteIntegrationPluginZip:
				await sqliteIntegrationPluginZip?.arrayBuffer(),
		});

		return playground;
	}

	async bootPlayground({
		workerProcess,
		firstProcessId,
		nativeInternalDirPath,
	}: {
		workerProcess: SpawnedWorker;
		firstProcessId: number;
		nativeInternalDirPath: string;
	}) {
		const playground = consumeAPI<PlaygroundCliBlueprintV1Worker>(
			// TODO: Fix this type error.
			// @ts-ignore
			workerProcess
		);

		await playground.isConnected();
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			this.getEffectiveBlueprint()
		);
		await playground.bootWorker({
			port: this.args.port,
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
			withXdebug: !!this.args.xdebug,
			nativeInternalDirPath,
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
				e.detail.caption || lastCaption || 'Running the Blueprint';
			const message = `${lastCaption.trim()} – ${progressInteger}%`;
			this.writeProgressUpdate(
				process.stdout,
				message,
				progressReached100
			);
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

	writeProgressUpdate(
		writeStream: NodeJS.WriteStream,
		message: string,
		finalUpdate: boolean
	) {
		if (this.args.verbosity === LogVerbosity.Quiet.name) {
			return;
		}
		if (!shouldRenderProgress(writeStream)) {
			return;
		}
		if (message === this.lastProgressMessage) {
			// Avoid repeating the same message
			return;
		}
		this.lastProgressMessage = message;

		if (writeStream.isTTY) {
			// Overwrite previous progress updates in-place for a quieter UX.
			writeStream.cursorTo(0);
			writeStream.write(message);
			writeStream.clearLine(1);

			if (finalUpdate) {
				writeStream.write('\n');
			}
		} else {
			// Fall back to writing one line per progress update
			writeStream.write(`${message}\n`);
		}
	}
}
