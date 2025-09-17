import type { RemoteAPI, SupportedPHPVersion } from '@php-wasm/universal';
import { consumeAPI } from '@php-wasm/universal';
import type {
	PlaygroundCliBlueprintV2Worker,
	WorkerBootArgs,
} from './worker-thread-v2';
import type { MessagePort as NodeMessagePort } from 'worker_threads';
import type { RunCLIArgs, SpawnedWorker, WorkerType } from '../run-cli';

/**
 * Boots Playground CLI workers using Blueprint version 2.
 *
 * Progress tracking, downloads, steps, and all other features are
 * implemented in PHP and orchestrated by the worker thread.
 */
export class BlueprintsV2Handler {
	private phpVersion: SupportedPHPVersion;
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
		this.phpVersion = args.php as SupportedPHPVersion;
	}

	getWorkerType(): WorkerType {
		return 'v2';
	}

	async bootPrimaryWorker(
		phpPort: NodeMessagePort,
		fileLockManagerPort: NodeMessagePort
	) {
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			consumeAPI(phpPort);

		await playground.useFileLockManager(fileLockManagerPort);

		const workerBootArgs = {
			...this.args,
			php: this.phpVersion,
			siteUrl: this.siteUrl,
			firstProcessId: 1,
			processIdSpaceLength: this.processIdSpaceLength,
			trace: this.args.debug || false,
			blueprint: this.args.blueprint!,
		};

		await playground.bootAsPrimaryWorker(workerBootArgs);
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
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			consumeAPI(worker.phpPort);

		await playground.useFileLockManager(fileLockManagerPort);

		const workerBootArgs: WorkerBootArgs = {
			...this.args,
			php: this.phpVersion!,
			siteUrl: this.siteUrl,
			firstProcessId,
			processIdSpaceLength: this.processIdSpaceLength,
			trace: this.args.debug || false,
			blueprint: this.args.blueprint!,
		};

		await playground.bootAsSecondaryWorker(workerBootArgs);

		return playground;
	}

	writeProgressUpdate(
		writeStream: NodeJS.WriteStream,
		message: string,
		finalUpdate: boolean
	) {
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
