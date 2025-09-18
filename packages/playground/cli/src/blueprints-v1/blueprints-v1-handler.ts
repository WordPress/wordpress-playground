import { logger } from '@php-wasm/logger';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { consumeAPI } from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import { compileBlueprint, isBlueprintBundle } from '@wp-playground/blueprints';
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
	LogVerbosity,
	type RunCLIArgs,
	type SpawnedWorker,
	type WorkerType,
} from '../run-cli';

/**
 * Boots Playground CLI workers using Blueprint version 1.
 *
 * Progress tracking, downloads, steps, and all other features are
 * implemented in TypeScript and orchestrated by this class.
 */
export class BlueprintsV1Handler {
	private phpVersion: SupportedPHPVersion | undefined;
	private lastProgressMessage = '';

	private siteUrl: string;
	private processIdSpaceLength: number;
	private args: RunCLIArgs;

	constructor(
		args: RunCLIArgs,
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

	async bootPrimaryWorker(
		phpPort: NodeMessagePort,
		fileLockManagerPort: NodeMessagePort,
		nativeInternalDirPath: string
	) {
		const compiledBlueprint = await this.compileInputBlueprint(
			this.args['additional-blueprint-steps'] || []
		);
		this.phpVersion = compiledBlueprint.versions.php;

		let wpDetails: any = undefined;
		// @TODO: Rename to FetchProgressMonitor. There's nothing Emscripten
		// about that class anymore.
		const monitor = new EmscriptenDownloadMonitor();
		if (!this.args.skipWordPressSetup) {
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
			logger.log(
				`Resolved WordPress release URL: ${wpDetails?.releaseUrl}`
			);
		}

		const preinstalledWpContentPath =
			wpDetails &&
			path.join(
				CACHE_FOLDER,
				`prebuilt-wp-content-for-wp-${wpDetails.version}.zip`
			);
		const wordPressZip = !wpDetails
			? undefined
			: fs.existsSync(preinstalledWpContentPath)
			? readAsFile(preinstalledWpContentPath)
			: await cachedDownload(
					wpDetails.releaseUrl,
					`${wpDetails.version}.zip`,
					monitor
			  );

		logger.log(`Fetching SQLite integration plugin...`);
		const sqliteIntegrationPluginZip = this.args.skipSqliteSetup
			? undefined
			: await fetchSqliteIntegration(monitor);

		const followSymlinks = this.args.followSymlinks === true;
		const trace = this.args.experimentalTrace === true;

		const mountsBeforeWpInstall = this.args['mount-before-install'] || [];
		const mountsAfterWpInstall = this.args.mount || [];

		const playground = consumeAPI<PlaygroundCliBlueprintV1Worker>(phpPort);

		// Comlink communication proxy
		await playground.isConnected();

		logger.log(`Booting WordPress...`);

		await playground.useFileLockManager(fileLockManagerPort);
		await playground.bootAsPrimaryWorker({
			phpVersion: this.phpVersion,
			wpVersion: compiledBlueprint.versions.wp,
			siteUrl: this.siteUrl,
			mountsBeforeWpInstall,
			mountsAfterWpInstall,
			wordPressZip: wordPressZip && (await wordPressZip!.arrayBuffer()),
			sqliteIntegrationPluginZip:
				await sqliteIntegrationPluginZip?.arrayBuffer(),
			firstProcessId: 0,
			processIdSpaceLength: this.processIdSpaceLength,
			followSymlinks,
			trace,
			internalCookieStore: this.args.internalCookieStore,
			withXdebug: this.args.xdebug,
			nativeInternalDirPath,
		});

		if (
			wpDetails &&
			!this.args['mount-before-install'] &&
			!fs.existsSync(preinstalledWpContentPath)
		) {
			logger.log(`Caching preinstalled WordPress for the next boot...`);
			fs.writeFileSync(
				preinstalledWpContentPath,
				(await zipDirectory(playground, '/wordpress'))!
			);
			logger.log(`Cached!`);
		}

		return playground;
	}

	async bootSecondaryWorker({
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
		const additionalPlayground = consumeAPI<PlaygroundCliBlueprintV1Worker>(
			worker.phpPort
		);

		await additionalPlayground.isConnected();
		await additionalPlayground.useFileLockManager(fileLockManagerPort);
		await additionalPlayground.bootAsSecondaryWorker({
			phpVersion: this.phpVersion!,
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
			withXdebug: this.args.xdebug,
			nativeInternalDirPath,
		});
		await additionalPlayground.isReady();
		return additionalPlayground;
	}

	async compileInputBlueprint(additionalBlueprintSteps: any[]) {
		const args = this.args;
		const resolvedBlueprint = args.blueprint as BlueprintV1Declaration;
		/**
		 * @TODO This looks similar to the resolveBlueprint() call in the website package:
		 * 	     https://github.com/WordPress/wordpress-playground/blob/ce586059e5885d185376184fdd2f52335cca32b0/packages/playground/website/src/main.tsx#L41
		 *
		 * 		 Also the Blueprint Builder tool does something similar.
		 *       Perhaps all these cases could be handled by the same function?
		 */
		const blueprint: BlueprintV1Declaration | BlueprintBundle =
			isBlueprintBundle(resolvedBlueprint)
				? resolvedBlueprint
				: {
						login: args.login,
						...(resolvedBlueprint || {}),
						preferredVersions: {
							php:
								args.php ??
								resolvedBlueprint?.preferredVersions?.php ??
								RecommendedPHPVersion,
							wp:
								args.wp ??
								resolvedBlueprint?.preferredVersions?.wp ??
								'latest',
							...(resolvedBlueprint?.preferredVersions || {}),
						},
				  };

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
		return await compileBlueprint(blueprint as BlueprintV1Declaration, {
			progress: tracker,
			additionalSteps: additionalBlueprintSteps,
		});
	}

	writeProgressUpdate(
		writeStream: NodeJS.WriteStream,
		message: string,
		finalUpdate: boolean
	) {
		if (this.args.verbosity === LogVerbosity.Quiet.name) {
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
