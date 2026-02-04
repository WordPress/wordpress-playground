import type {
	PHPRequest,
	PHPResponse,
	RemoteAPI,
	StreamedPHPResponse,
} from '@php-wasm/universal';
import type { PlaygroundCliBlueprintV1Worker as PlaygroundCliWorkerV1 } from './blueprints-v1/worker-thread-v1';
import type { PlaygroundCliBlueprintV2Worker as PlaygroundCliWorkerV2 } from './blueprints-v2/worker-thread-v2';

type PlaygroundCliWorker = PlaygroundCliWorkerV1 | PlaygroundCliWorkerV2;

// TODO: Let's merge worker management into PHPProcessManager
// when we can have multiple workers in both CLI and web.
// ¡ATTENTION!:Please don't expand upon this as an independent abstraction.

// TODO: Could we just spawn a worker using the factory function to PHPProcessManager?
type WorkerLoad = {
	worker: RemoteAPI<PlaygroundCliWorker>;
	activeRequests: Set<Promise<void>>;
};
export class LoadBalancer {
	workerLoads: WorkerLoad[] = [];

	constructor(
		// NOTE: We require a worker to start so that a load balancer
		// may not exist without being able to service requests.
		// Playground CLI initialization, as of 2025-06-11, requires that
		// an initial worker is booted alone and initialized via Blueprint
		// before additional workers are created based on the initialized worker.
		initialWorker: RemoteAPI<PlaygroundCliWorker>
	) {
		this.addWorker(initialWorker);
	}

	addWorker(worker: RemoteAPI<PlaygroundCliWorker>) {
		this.workerLoads.push({
			worker,
			activeRequests: new Set(),
		});
	}
	async removeWorker(worker: RemoteAPI<PlaygroundCliWorker>) {
		const workerIndex = this.workerLoads.findIndex(
			(workerLoad) => workerLoad.worker === worker
		);
		if (workerIndex === -1) {
			return;
		}

		const [removedWorker] = this.workerLoads.splice(workerIndex, 1);

		// A worker can only be considered fully removed once all
		// its active requests have settled.
		await Promise.allSettled(removedWorker.activeRequests);
	}

	/**
	 * Handle a request with streaming support for large responses.
	 * Returns a StreamedPHPResponse that allows processing the response
	 * body incrementally without buffering in memory.
	 */
	async handleRequest(
		request: PHPRequest
	): Promise<StreamedPHPResponse | PHPResponse> {
		let smallestWorkerLoad = this.workerLoads[0];

		for (let i = 1; i < this.workerLoads.length; i++) {
			const workerLoad = this.workerLoads[i];
			if (
				workerLoad.activeRequests.size <
				smallestWorkerLoad.activeRequests.size
			) {
				smallestWorkerLoad = workerLoad;
			}
		}

		const promiseForResponse =
			smallestWorkerLoad.worker.requestStreamed(request);

		// Track the request while it's active
		// For streaming responses, we wait for the stream to finish before
		// considering the request complete (used for worker removal timing)
		const trackingPromise: Promise<void> = promiseForResponse
			.then((response) => {
				if ('finished' in response) {
					return response.finished;
				}
				// Non-streaming response: already complete
				return;
			})
			.catch(() => {
				// Error handling is done in start-server.ts
				// This catch prevents unhandled rejection warnings
			});
		smallestWorkerLoad.activeRequests.add(trackingPromise);

		// Add URL to promise for use while debugging
		(promiseForResponse as any).url = request.url;

		// Clean up tracking when the response stream is fully consumed
		trackingPromise.finally(() => {
			smallestWorkerLoad.activeRequests.delete(trackingPromise);
		});

		return promiseForResponse;
	}
}
