import type { Pooled, SupportedPHPVersion } from '@php-wasm/universal';
import { consumeAPI, type RemoteAPI } from '@php-wasm/universal';
import type {
	PlaygroundCliBlueprintV2Worker,
	SecondaryWorkerBootArgs,
} from './worker-thread-v2';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import {
	type PlaygroundCliWorker,
	type RunCLIArgs,
	type SpawnedWorker,
	type WorkerType,
	mergeDefinedConstants,
} from '../run-cli';
import type { CLIOutput } from '../cli-output';

/**
 * Boots Playground CLI workers using Blueprint version 2.
 *
 * Progress tracking, downloads, steps, and all other features are
 * implemented in PHP and orchestrated by the worker thread.
 */
export class BlueprintsV2Handler {
	private phpVersion: SupportedPHPVersion;

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
		this.phpVersion = args.php as SupportedPHPVersion;
		this.cliOutput = options.cliOutput;
	}

	getWorkerType(): WorkerType {
		return 'v2';
	}

	async bootWordPress(
		playground: Pooled<PlaygroundCliWorker>,
		workerPostInstallMountsPort: NodeMessagePort
	) {
		const workerBootArgs = {
			command: this.args.command,
			siteUrl: this.siteUrl,
			blueprint: this.args.blueprint!,
			workerPostInstallMountsPort,
		};

		// TODO: Fix this type issue that requires the cast to unknown
		await (
			playground as unknown as PlaygroundCliBlueprintV2Worker
		).bootWordPress(workerBootArgs, workerPostInstallMountsPort);
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
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			consumeAPI(worker.phpPort);

		await playground.useFileLockManager(fileLockManagerPort);

		const workerBootArgs: SecondaryWorkerBootArgs = {
			...this.args,
			phpVersion: this.phpVersion,
			siteUrl: this.siteUrl,
			processId: worker.processId,
			trace: this.args.verbosity === 'debug',
			withIntl: this.args.intl,
			withRedis: this.args.redis,
			withMemcached: this.args.memcached,
			withXdebug: !!this.args.xdebug,
			nativeInternalDirPath,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args.mount || [],
			constants: mergeDefinedConstants(this.args),
		};

		await playground.bootWorker(workerBootArgs);

		return playground;
	}
}
