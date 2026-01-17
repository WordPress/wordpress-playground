import type { RemoteAPI, SupportedPHPVersion } from '@php-wasm/universal';
import { consumeAPI } from '@php-wasm/universal';
import type {
	PlaygroundCliBlueprintV2Worker,
	SecondaryWorkerBootArgs,
} from './worker-thread-v2';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import type { RunCLIArgs, SpawnedWorker, WorkerType } from '../run-cli';
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

	async bootAndSetUpInitialPlayground(
		phpPort: NodeMessagePort,
		fileLockManagerPort: NodeMessagePort,
		nativeInternalDirPath: string
	) {
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			consumeAPI(phpPort);

		await playground.useFileLockManager(fileLockManagerPort);

		const workerBootArgs = {
			...this.args,
			phpVersion: this.phpVersion,
			siteUrl: this.siteUrl,
			firstProcessId: 1,
			processIdSpaceLength: this.processIdSpaceLength,
			trace: this.args.verbosity === 'debug',
			blueprint: this.args.blueprint!,
			withIntl: this.args.intl,
			// We do not enable Xdebug by default for the initial worker
			// because we do not imagine users expect to hit breakpoints
			// until Playground has fully booted.
			// TODO: Consider supporting Xdebug for the initial worker via a dedicated flag.
			withXdebug: false,
			xdebug: undefined,
			nativeInternalDirPath,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args.mount || [],
		};

		await playground.bootAndSetUpInitialWorker(workerBootArgs);
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
			withXdebug: !!this.args.xdebug,
			nativeInternalDirPath,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args.mount || [],
		};

		await playground.bootWorker(workerBootArgs);

		return playground;
	}
}
