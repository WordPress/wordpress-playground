// TODO: Is there any reason we should not delete this unused module and its tests?

import type { PHPRequest, PHPResponse } from '@php-wasm/universal';

// TODO: Let's merge worker management into PHPProcessManager
// when we can have multiple workers in both CLI and web.
// ¡ATTENTION!:Please don't expand upon this as an independent
// abstraction.
// TODO: From Brandon: ^Do you still think this, Adam Ziel?
//       I think they may be separate

// TODO: Could we just spawn a worker using the factory
//       function to PHPProcessManager?

export interface LoadBalancerWorker {
	request(request: PHPRequest): Promise<PHPResponse>;
}

type InProgressRequest = {
	request: PHPRequest;
	promisedResponse: Promise<PHPResponse>;
};
type QueuedRequest = {
	request: PHPRequest;
	resolve: (response: PHPResponse | PromiseLike<PHPResponse>) => void;
	reject: (reason?: any) => void;
};
export class LoadBalancer {
	// NOTE: This is just a list of the workers we think we have,
	// for visibility when debugging. The bookkeeping for load
	// balancing is done using separate collections of free and
	// busy workers.
	workers: LoadBalancerWorker[] = [];

	// Workers ready to work.
	freeWorkers: LoadBalancerWorker[] = [];

	// Workers that are working.
	busyWorkers = new Map<LoadBalancerWorker, InProgressRequest>();

	// Requests waiting for a worker.
	queuedRequests: QueuedRequest[] = [];

	constructor(workers: LoadBalancerWorker[]) {
		this.workers.push(...workers);
		this.freeWorkers.push(...workers);
	}

	async handleRequest(request: PHPRequest): Promise<PHPResponse> {
		const promisedResponse = new Promise<PHPResponse>((resolve, reject) => {
			this.queuedRequests.push({
				request,
				resolve,
				reject,
			});
		});
		this.dispatchQueuedRequests();
		return promisedResponse;
	}

	private dispatchQueuedRequests() {
		while (this.queuedRequests.length > 0 && this.freeWorkers.length > 0) {
			const { request, resolve, reject } = this.queuedRequests.shift()!;
			const worker = this.freeWorkers.shift()!;

			const promisedResponse = worker.request(request).finally(() => {
				this.busyWorkers.delete(worker);
				this.freeWorkers.push(worker);

				this.dispatchQueuedRequests();
			});

			promisedResponse.then(resolve, reject);

			this.busyWorkers.set(worker, {
				request,
				promisedResponse,
			});
		}
	}
}
