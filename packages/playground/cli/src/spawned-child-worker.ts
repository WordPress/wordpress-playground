import {
	consumeAPI,
	defineAPITransferPolicy,
	releaseApiProxy,
	type RemoteAPI,
} from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import type { MessagePort } from 'worker_threads';
import type {
	ChildWorkerService,
	WorkerBootApi,
	WorkerPlatformConfig,
} from './worker-boot-config';
import { workerBootApiTransferPolicy } from './worker-boot-config';

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
			spawnedChildWorkerTransferPolicy
		);
		childApi = activeChildApi;
		await completeBeforeChildExits(
			activeChildApi.useFileLockManager(fileLockManagerPort),
			runtimeExited
		);
		await completeBeforeChildExits(
			activeChildApi.bootRequestHandler(platformConfig, workerConfig),
			runtimeExited
		);
		// A child created after WordPress installation must not execute PHP until
		// the service has applied the mounts it recorded for future workers.
		await completeBeforeChildExits(
			childWorkerService.waitForChildReady(childId),
			runtimeExited
		);

		return {
			php: activeChildApi as unknown as RemoteAPI<WorkerApi>,
			runtimeExited,
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

/**
 * Do not let a child crash leave a pending Comlink operation unresolved.
 * Closing a MessagePort does not reject calls already waiting for a response,
 * so every boot operation must either complete while the child is alive or
 * fail as soon as its positive exit signal settles.
 */
function completeBeforeChildExits<T>(
	operation: Promise<T>,
	runtimeExited: Promise<void>
): Promise<T> {
	const childExitedBeforeCompletion = runtimeExited.then(
		function throwChildExitError(): never {
			throw new Error(
				'Child worker exited before its boot operation completed.'
			);
		}
	);
	return Promise.race([operation, childExitedBeforeCompletion]);
}

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
