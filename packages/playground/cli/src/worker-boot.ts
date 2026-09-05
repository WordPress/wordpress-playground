/**
 * Shared boot protocol for Playground CLI workers.
 *
 * Both Blueprint worker implementations use this module to exchange boot
 * configuration, transfer the MessagePorts a worker needs, and finish wiring a
 * child created for proc_open() or system(). Keeping those contracts and the
 * boot operation together prevents the v1 and v2 workers from implementing
 * subtly different process behavior.
 *
 * Once the CLI uses the Blueprint v2 worker for both Blueprint formats, this
 * shared code can move into that single worker implementation.
 */
import type { PHPExtension } from '@php-wasm/node';
import {
	consumeAPI,
	defineAPITransferPolicy,
	releaseApiProxy,
	type AllPHPVersion,
	type PathAlias,
	type RemoteAPI,
} from '@php-wasm/universal';
import type { Mount } from '@php-wasm/cli-util';
import { logger } from '@php-wasm/logger';
import type { MessagePort } from 'worker_threads';

export const CHILD_WORKER_CONTROL_READY = 'child-worker-control-ready';

/**
 * Boot configuration shared by every worker in a Playground CLI run.
 *
 * It is identical across the primary request-handling workers and any child
 * worker spawned via `proc_open()`/`system()`, so a parent worker can forward
 * it to its children unchanged. Keeping the shared, platform-wide settings in
 * their own type (separate from the per-worker {@link WorkerConfig}) means we
 * can pass the platform config on to a child worker without having to remember
 * to strip out worker-specific fields such as `processId`.
 */
export interface WorkerPlatformConfig {
	siteUrl: string;
	phpVersion: AllPHPVersion;
	trace: boolean;
	/**
	 * Blueprints v2 only: toggles the networking-related php.ini entries and
	 * `disable_functions`. Unused by the v1 worker.
	 */
	networking?: boolean;
	nativeInternalDirPath: string;
	mountsBeforeWpInstall: Array<Mount>;
	mountsAfterWpInstall: Array<Mount>;
	followSymlinks: boolean;
	extensions?: PHPExtension[];
	pathAliases?: PathAlias[];
}

/**
 * Per-worker boot configuration.
 *
 * Unlike {@link WorkerPlatformConfig}, these fields must NOT be forwarded
 * verbatim to a child worker: the main thread mints a fresh `processId` for
 * every worker (reusing one would let two PHP instances share OS-level file
 * locks) and distinct service/control endpoints.
 */
export interface WorkerConfig {
	processId: number;
	/**
	 * Connects this worker directly to the main-thread child-worker service.
	 * It belongs in the per-worker configuration because every worker receives
	 * a distinct endpoint, even though all endpoints expose the same service.
	 */
	childWorkerServicePort: MessagePort;
	/**
	 * Child workers expose their post-install mount API on this port after boot.
	 * Top-level request workers are mounted directly and do not receive one.
	 */
	childWorkerControlPort?: MessagePort;
}

/** Runtime options left after the worker consumes its transport endpoints. */
export type WorkerBootRequestHandlerOptions = WorkerPlatformConfig &
	Pick<WorkerConfig, 'processId'>;

/** Per-worker configuration that is present only for spawned children. */
export interface ChildWorkerConfig extends WorkerConfig {
	childWorkerControlPort: MessagePort;
}

/**
 * The complete, naturally transferable result of creating a child worker.
 *
 * All worker-owned endpoints travel together so the caller can either finish
 * booting the child or dispose it without a partially-consumed service record.
 */
export interface CreatedChildWorker {
	/** Monotonic handle used for service operations over the child's lifetime. */
	childId: number;
	/** Endpoint for the child's Playground/PHP API. */
	phpPort: MessagePort;
	/** Direct endpoint for the main-thread file lock manager. */
	fileLockManagerPort: MessagePort;
	/** Configuration passed to the child's `bootRequestHandler()`. */
	workerConfig: ChildWorkerConfig;
}

/** The private control API every child exposes to the main thread after boot. */
export interface ChildWorkerControl {
	mountAfterWordPressInstall: (mounts: Array<Mount>) => Promise<void>;
}

/**
 * The service the main thread exposes to every worker so it can create child
 * workers on demand. It replaces the older approach of having workers propagate
 * FileLockManager ports to their children: the main thread already owns the
 * FileLockManager and everything else needed to configure a worker.
 */
export interface ChildWorkerService {
	/** Spawn and pre-wire a child worker, returning every child-owned endpoint. */
	createChildWorker: () => Promise<CreatedChildWorker>;
	/** Wait until any previously recorded post-install mounts are applied. */
	waitForChildReady: (childId: number) => Promise<void>;
	/** Fulfill when the child exits, so pending remote calls can be interrupted. */
	waitForChildExit: (childId: number) => Promise<void>;
	/** Terminate a child worker and close the main-thread ports it was given. */
	disposeChildWorker: (childId: number) => Promise<void>;
}

export interface WorkerBootApi {
	bootRequestHandler(
		platformConfig: WorkerPlatformConfig,
		workerConfig: WorkerConfig
	): Promise<void>;
}

export const childWorkerServiceTransferPolicy =
	defineAPITransferPolicy<ChildWorkerService>({
		createChildWorker: {
			result: function transferCreatedChildWorker(child) {
				return [
					child.phpPort,
					child.fileLockManagerPort,
					child.workerConfig.childWorkerServicePort,
					child.workerConfig.childWorkerControlPort,
				];
			},
		},
	});

export const workerBootApiTransferPolicy =
	defineAPITransferPolicy<WorkerBootApi>({
		bootRequestHandler: {
			arguments: function transferWorkerBootArguments(
				_platformConfig,
				workerConfig
			) {
				return [
					workerConfig.childWorkerServicePort,
					...(workerConfig.childWorkerControlPort
						? [workerConfig.childWorkerControlPort]
						: []),
				];
			},
		},
	});

type SpawnedChildWorkerApi = WorkerBootApi & {
	useFileLockManager(port: MessagePort): Promise<void>;
};

const spawnedChildWorkerTransferPolicy =
	defineAPITransferPolicy<SpawnedChildWorkerApi>({
		bootRequestHandler: workerBootApiTransferPolicy.bootRequestHandler,
	});

/**
 * Ask the main thread for a child worker and finish wiring it before exposing
 * the child PHP proxy to the sandboxed spawn handler.
 *
 * The service returns all transferable ports in one response. Keeping the
 * wiring here means the v1 and v2 workers only deal with a ready child PHP API,
 * while the synchronous file-lock connection still goes directly from the
 * child to the main thread.
 */
export async function bootSpawnedChildWorker<
	WorkerApi extends SpawnedChildWorkerApi,
>(
	childWorkerService: RemoteAPI<ChildWorkerService>,
	platformConfig: WorkerPlatformConfig
) {
	const { childId, phpPort, fileLockManagerPort, workerConfig } =
		await childWorkerService.createChildWorker();
	const runtimeExited = childWorkerService.waitForChildExit(childId);
	let childApi: RemoteAPI<SpawnedChildWorkerApi> | undefined;

	try {
		const activeChildApi = consumeAPI<SpawnedChildWorkerApi>(
			phpPort,
			undefined,
			spawnedChildWorkerTransferPolicy,
			{ endpointTerminated: runtimeExited }
		);
		childApi = activeChildApi;
		await activeChildApi.useFileLockManager(fileLockManagerPort);
		await activeChildApi.bootRequestHandler(platformConfig, workerConfig);
		// A child created after WordPress installation must not execute PHP until
		// the service has applied the mounts it recorded for future workers.
		await childWorkerService.waitForChildReady(childId);

		return {
			php: activeChildApi as unknown as RemoteAPI<WorkerApi>,
			reap() {
				releaseChildApiProxyQuietly(childApi);
				// Reaping is deliberately fire-and-forget because the spawn-handler
				// contract is synchronous. The service also has an exit backstop and
				// disposeCLI() awaits any child still being terminated.
				childWorkerService
					.disposeChildWorker(childId)
					.catch(function reportReapFailure(error) {
						logger.error(
							`Failed to reap child worker ${childId}: ${String(error)}`
						);
					});
			},
		};
	} catch (error) {
		releaseChildApiProxyQuietly(childApi);
		try {
			await childWorkerService.disposeChildWorker(childId);
		} catch (disposeError) {
			// Preserve the child boot failure; disposal is best-effort here and
			// the service's exit backstop owns any remaining cleanup.
			logger.error(
				`Failed to dispose child worker ${childId} after a boot error: ` +
					String(disposeError)
			);
		}
		throw error;
	}
}

/** Release a child proxy even when its worker already closed the endpoint. */
function releaseChildApiProxyQuietly(
	childApi: RemoteAPI<SpawnedChildWorkerApi> | undefined
): void {
	if (!childApi) {
		return;
	}
	try {
		childApi[releaseApiProxy]();
	} catch {
		// The remote endpoint may already have released the proxy on exit.
	}
}
