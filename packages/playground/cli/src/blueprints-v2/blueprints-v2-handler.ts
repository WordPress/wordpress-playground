import type { RemoteAPI, SupportedPHPVersion } from '@php-wasm/universal';
import { exposeAPI, type NodeProcess } from '@php-wasm/universal';
import { consumeAPI } from '@php-wasm/universal';
import type {
	PlaygroundCliBlueprintV2Worker,
	WorkerBootArgs,
} from './worker-thread-v2';
import type {
	RunCLIArgsWithResolvedRequiredArgs,
	SpawnedWorker,
	WorkerType,
} from '../run-cli';
import { shouldRenderProgress } from '../utils/progress';

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
		this.phpVersion = args.php as SupportedPHPVersion;
	}

	getWorkerType(): WorkerType {
		return 'v2';
	}

	async bootWordPress(
		workerProcess: SpawnedWorker,
		onWordPressInstalled: () => Promise<void>
	) {
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			// TODO: Fix this type error.
			// @ts-ignore
			consumeAPI<PlaygroundCliBlueprintV2Worker>(workerProcess);

		const workerBootArgs = {
			...this.args,
			phpVersion: this.phpVersion,
			siteUrl: this.siteUrl,
			blueprint: this.args.blueprint!,
			// TODO: How can we still prevent Xdebug from being enabled
			// before WordPress is booted?
			// We do not enable Xdebug by default for the initial worker
			// because we do not imagine users expect to hit breakpoints
			// until Playground has fully booted.
			// TODO: Consider supporting Xdebug for the initial worker via a dedicated flag.
		};

		// TODO: Fix this need to cast due to type error.
		// @ts-ignore
		exposeAPI(
			onWordPressInstalled,
			undefined,
			workerProcess as NodeProcess
		);
		await playground.bootWordPress(workerBootArgs);
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
		const playground: RemoteAPI<PlaygroundCliBlueprintV2Worker> =
			// TODO: Fix this type error.
			// @ts-ignore
			consumeAPI<PlaygroundCliBlueprintV2Worker>(workerProcess);

		const workerBootArgs: WorkerBootArgs = {
			...this.args,
			phpVersion: this.phpVersion,
			siteUrl: this.siteUrl,
			firstProcessId,
			processIdSpaceLength: this.processIdSpaceLength,
			trace: this.args.debug || false,
			withIntl: this.args.intl,
			withXdebug: !!this.args.xdebug,
			nativeInternalDirPath,
			mountsBeforeWpInstall: this.args['mount-before-install'] || [],
			mountsAfterWpInstall: this.args.mount || [],
		};

		await playground.bootWorker(workerBootArgs);

		return playground;
	}

	writeProgressUpdate(
		writeStream: NodeJS.WriteStream,
		message: string,
		finalUpdate: boolean
	) {
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
