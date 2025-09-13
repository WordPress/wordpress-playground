import { logger } from '@php-wasm/logger';
import { ProgressTracker } from '@php-wasm/progress';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { consumeAPI } from '@php-wasm/universal';
import type {
	BlueprintBundle,
	BlueprintDeclaration,
} from '@wp-playground/blueprints';
import { compileBlueprint, isBlueprintBundle } from '@wp-playground/blueprints';
import { RecommendedPHPVersion, zipDirectory } from '@wp-playground/common';
import path from 'path';
import type { PlaygroundCliBlueprintV1Worker } from './worker-thread-v1';
// @ts-ignore
import importedWorkerV1UrlString from './worker-thread-v1?worker&url';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import { MessageChannel as NodeMessageChannel } from 'worker_threads';
import { LogVerbosity, type RunCLIArgs, type SpawnedWorker } from '../run-cli';

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

	getWorkerUrl() {
		if (
			process.env['VITEST'] &&
			importedWorkerV1UrlString.startsWith('/src/')
		) {
			// Work around issue where Vitest cannot find the worker script.
			return path.join(
				import.meta.dirname,
				'..',
				'..',
				importedWorkerV1UrlString
			);
		}
		return importedWorkerV1UrlString;
	}

	async bootPrimaryWorker(
		phpPort: NodeMessagePort,
		fileLockManagerPort: NodeMessagePort
	) {
		const compiledBlueprint = await this.compileInputBlueprint(
			this.args['additional-blueprint-steps'] || []
		);
		this.phpVersion = compiledBlueprint.versions.php;

		// Set up progress channel to receive worker-side progress updates
		const { port1: progressPortForWorker, port2: progressPortForHandler } =
			new NodeMessageChannel();
		progressPortForHandler.on('message', (msg: any) => {
			if (!msg || typeof msg !== 'object') {
				return;
			}
			if (msg.type === 'progress') {
				const { phase, loaded, total, finished } = msg;
				const percentProgress = total
					? Math.floor(Math.min(100, (100 * loaded) / total))
					: finished
					? 100
					: 0;
				const label =
					phase === 'sqlite'
						? 'Downloading SQLite integration plugin'
						: 'Downloading WordPress';
				this.writeProgressUpdate(
					process.stdout,
					`${label} ${percentProgress}%...`,
					finished || percentProgress === 100
				);
			} else if (msg.type === 'error') {
				logger.error(msg.message || 'Unknown error in worker');
			}
		});

		const followSymlinks = this.args.followSymlinks === true;
		const trace = this.args.experimentalTrace === true;

		const mountsBeforeWpInstall = this.args['mount-before-install'] || [];
		const mountsAfterWpInstall = this.args.mount || [];

		const playground = consumeAPI<PlaygroundCliBlueprintV1Worker>(phpPort);

		// Comlink communication proxy
		await playground.isConnected();
		await playground.setProgressPort(progressPortForWorker as any);

		logger.log(`Booting WordPress...`);

		await playground.useFileLockManager(fileLockManagerPort);
		await playground.bootAsPrimaryWorker({
			phpVersion: this.phpVersion,
			wpVersion: compiledBlueprint.versions.wp,
			absoluteUrl: this.siteUrl,
			mountsBeforeWpInstall,
			mountsAfterWpInstall,
			firstProcessId: 0,
			processIdSpaceLength: this.processIdSpaceLength,
			followSymlinks,
			trace,
			internalCookieStore: this.args.internalCookieStore,
			withXdebug: this.args.xdebug,
			skipWordPressSetup: this.args.skipWordPressSetup,
			skipSqliteSetup: this.args.skipSqliteSetup,
		});

		return playground;
	}

	async bootSecondaryWorker({
		worker,
		fileLockManagerPort,
		firstProcessId,
	}: {
		worker: SpawnedWorker;
		fileLockManagerPort: NodeMessagePort;
		firstProcessId: number;
	}) {
		const additionalPlayground = consumeAPI<PlaygroundCliBlueprintV1Worker>(
			worker.phpPort
		);

		await additionalPlayground.isConnected();
		await additionalPlayground.useFileLockManager(fileLockManagerPort);
		await additionalPlayground.bootAsSecondaryWorker({
			phpVersion: this.phpVersion,
			absoluteUrl: this.siteUrl,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args['mount'] || [],
			// Skip WordPress zip because we share the /wordpress directory
			// populated by the initial worker.
			wordPressZip: undefined,
			// Skip SQLite integration plugin for now because we
			// will copy it from primary's `/internal` directory.
			sqliteIntegrationPluginZip: undefined,
			dataSqlPath: '/wordpress/wp-content/database/.ht.sqlite',
			firstProcessId,
			processIdSpaceLength: this.processIdSpaceLength,
			followSymlinks: this.args.followSymlinks === true,
			trace: this.args.experimentalTrace === true,
			// @TODO: Move this to the request handler or else every worker
			//        will have a separate cookie store.
			internalCookieStore: this.args.internalCookieStore,
			withXdebug: this.args.xdebug,
			skipWordPressSetup: true,
			skipSqliteSetup: true,
		});
		await additionalPlayground.isReady();
		return additionalPlayground;
	}

	async compileInputBlueprint(additionalBlueprintSteps: any[]) {
		const args = this.args;
		const resolvedBlueprint = args.blueprint as BlueprintDeclaration;

		/**
		 * @TODO This looks similar to the resolveBlueprint() call in the website package:
		 * 	     https://github.com/WordPress/wordpress-playground/blob/ce586059e5885d185376184fdd2f52335cca32b0/packages/playground/website/src/main.tsx#L41
		 *
		 * 		 Also the Blueprint Builder tool does something similar.
		 *       Perhaps all these cases could be handled by the same function?
		 */
		const blueprint: BlueprintDeclaration | BlueprintBundle =
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
		return await compileBlueprint(blueprint as BlueprintDeclaration, {
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
