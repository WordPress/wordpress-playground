import type { RemoteAPI, SupportedPHPVersion } from '@php-wasm/universal';
import { consumeAPI } from '@php-wasm/universal';
import type {
	PlaygroundCliBlueprintV2Worker,
	SecondaryWorkerBootArgs,
} from './worker-thread-v2';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import {
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
		this.phpVersion = args.php as SupportedPHPVersion;
		this.cliOutput = options.cliOutput;
	}

	getWorkerType(): WorkerType {
		return 'v2';
	}

	async bootWordPress(
		phpPort: NodeMessagePort,
		workerPostInstallMountsPort: NodeMessagePort
	) {
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			consumeAPI(phpPort);

		const workerBootArgs = {
			command: this.args.command,
			siteUrl: this.siteUrl,
			blueprint: this.args.blueprint!,
			workerPostInstallMountsPort,
		};

		await playground.bootWordPress(
			workerBootArgs,
			workerPostInstallMountsPort
		);
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
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			consumeAPI(worker.phpPort);

		await playground.useFileLockManager(fileLockManagerPort);

		const workerBootArgs: SecondaryWorkerBootArgs = {
			...this.args,
			phpVersion: this.phpVersion,
			siteUrl: this.siteUrl,
			firstProcessId,
			processIdSpaceLength: this.processIdSpaceLength,
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
