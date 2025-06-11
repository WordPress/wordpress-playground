import type { PHPRequest, PHPResponse, RemoteAPI } from '@php-wasm/universal';
import type { PlaygroundCliWorker } from './worker-thread';
import { logger } from '@php-wasm/logger';

// TODO: Let's merge worker management into PHPProcessManager
// when we can have multiple workers in both CLI and web.
// Please don't expand upon this as an independent abstraction.
// TODO: Could we just spawn a worker using the factory function to PHPProcessManager?
type WorkerLoad = {
	worker: RemoteAPI<PlaygroundCliWorker>;
	activeRequests: Set<Promise<PHPResponse>>;
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

	async handleRequest(request: PHPRequest) {
		let smallestWorkerLoad = this.workerLoads[0];
		let smallestWorkerLoadIndex = 0;

		// TODO: Is there any way for us to track CPU load so we could avoid
		//       picking a worker that is under heavy load despite few requests?
		// Possibly this: https://nodejs.org/api/worker_threads.html#workerperformance
		// Though we probably don't need to worry about it.
		for (let i = 1; i < this.workerLoads.length; i++) {
			const workerLoad = this.workerLoads[i];
			if (
				workerLoad.activeRequests.size <
				smallestWorkerLoad.activeRequests.size
			) {
				smallestWorkerLoad = workerLoad;
				smallestWorkerLoadIndex = i;
			}
		}

		// TODO: Add trace facility to Playground CLI to observe internals
		// TODO: Remove this after testing
		logger.log(
			`selected worker ${smallestWorkerLoadIndex} for ${
				request.url
			} out of workloads ${this.workerLoads.map(
				(w, i) => `${i}: ${w.activeRequests.size}`
			)}`
		);

		const promiseForResponse = smallestWorkerLoad.worker.request(request);
		smallestWorkerLoad.activeRequests.add(promiseForResponse);

		// Add URL to promise for use while debugging
		(promiseForResponse as any).url = request.url;

		return promiseForResponse.finally(() => {
			// TODO: Add trace for each request
			// console.log(
			// 	`worker ${smallestWorkerLoadIndex} completed request for ${request.url}`
			// );
			smallestWorkerLoad.activeRequests.delete(promiseForResponse);
		});
	}
}
