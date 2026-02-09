/**
 * WorkerPoolInstanceManager — runs each PHP instance in its own web worker.
 *
 * Instead of creating multiple PHP-WASM instances in the same thread
 * (like PHPProcessManager does), this manager spawns dedicated sub-workers.
 * Each sub-worker loads its own PHP-WASM runtime and mounts the same
 * SABMEMFS buffers, so they all share the /wordpress filesystem via
 * SharedArrayBuffer while executing PHP code in parallel.
 *
 * The coordinator worker keeps its own primary PHP instance for
 * static file checks and filesystem operations. Dynamic PHP requests
 * go through sub-workers via acquirePHPInstance().
 */

import { AcquireTimeoutError, Semaphore } from '@php-wasm/util';
import { PHPResponse, MaxPhpInstancesError } from '@php-wasm/universal';
import type { PHP } from '@php-wasm/universal';
import type { PHPInstanceManager, AcquiredPHP } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import type { SubWorkerInitConfig } from './php-sub-worker';

/**
 * A lightweight proxy that wraps postMessage-based RPC to a sub-worker
 * and presents it as a PHP-like interface to PHPRequestHandler.
 *
 * PHPRequestHandler's #dispatchToPHP only calls php.run(), so we only
 * need to implement that method. Other methods exist for the spawn
 * handler's use case.
 */
class SubWorkerPHPProxy {
	private worker: Worker;
	private callId = 0;
	private pendingCalls = new Map<
		number,
		{ resolve: (v: any) => void; reject: (e: Error) => void }
	>();

	constructor(worker: Worker) {
		this.worker = worker;
		this.worker.addEventListener('message', (event: MessageEvent) => {
			this.handleMessage(event.data);
		});
	}

	private handleMessage(msg: any) {
		if (!msg) return;

		if (msg.type === 'result' || msg.type === 'error') {
			const pending = this.pendingCalls.get(msg.id);
			if (pending) {
				this.pendingCalls.delete(msg.id);
				if (msg.type === 'error') {
					pending.reject(new Error(msg.error));
				} else {
					pending.resolve(msg.value);
				}
			}
		}
	}

	/**
	 * Call a method on the sub-worker's PHP instance via postMessage RPC.
	 */
	call(method: string, ...args: any[]): Promise<any> {
		const id = this.callId++;
		return new Promise((resolve, reject) => {
			this.pendingCalls.set(id, { resolve, reject });
			this.worker.postMessage({ id, type: 'call', method, args });
		});
	}

	async run(options: any): Promise<PHPResponse> {
		const result = await this.call('run', options);
		// Reconstruct PHPResponse from the serialized plain object
		return new PHPResponse(
			result.httpStatusCode,
			result.headers,
			result.bytes,
			result.errors,
			result.exitCode
		);
	}

	async cli(
		args: string[],
		options?: { env?: Record<string, string> }
	): Promise<any> {
		return await this.call('cli', args, options);
	}

	async chdir(path: string): Promise<void> {
		await this.call('chdir', path);
	}

	async cwd(): Promise<string> {
		return await this.call('cwd');
	}

	async listFiles(
		path: string,
		options?: { prependPath?: boolean }
	): Promise<string[]> {
		return await this.call('listFiles', path, options);
	}

	async setSapiName(name: string): Promise<void> {
		await this.call('setSapiName', name);
	}

	async exit(): Promise<void> {
		await this.call('exit');
	}

	// The following methods are called by PHPWorker.registerWorkerListeners()
	// on every acquired instance. Sub-worker events stay within their own
	// worker — forwarding them to the coordinator is a future enhancement.
	addEventListener(): void {
		// No-op: sub-worker events are not forwarded to the coordinator.
	}

	removeEventListener(): void {
		// No-op
	}

	onMessage(): void {
		// No-op
	}

	terminate(): void {
		this.worker.terminate();
		for (const pending of this.pendingCalls.values()) {
			pending.reject(new Error('Worker terminated'));
		}
		this.pendingCalls.clear();
	}
}

interface PooledWorker {
	proxy: SubWorkerPHPProxy;
	worker: Worker;
	busy: boolean;
	/** 1-based worker ID for console logging. */
	id: number;
}

export interface WorkerPoolConfig {
	/** The coordinator's primary PHP instance (for getPrimaryPhp). */
	primaryPhp: PHP;
	/** Maximum number of sub-workers to spawn. */
	maxWorkers: number;
	/** Configuration for initializing each sub-worker identically. */
	subWorkerConfig: SubWorkerInitConfig;
	/** Timeout in milliseconds for acquiring a worker (default: 30000). */
	timeout?: number;
}

export class WorkerPoolInstanceManager implements PHPInstanceManager {
	private primaryPhp: PHP;
	private maxWorkers: number;
	private subWorkerConfig: SubWorkerInitConfig;
	private workers: PooledWorker[] = [];
	private idleWorkers: PooledWorker[] = [];
	private semaphore: Semaphore;
	private nextWorkerId = 1;
	/**
	 * Resolves once all workers have been pre-spawned. Requests
	 * arriving before this settles will await it so that all
	 * workers are ready to handle traffic immediately.
	 */
	private spawnReady: Promise<void>;

	constructor(config: WorkerPoolConfig) {
		this.primaryPhp = config.primaryPhp;
		this.maxWorkers = config.maxWorkers;
		this.subWorkerConfig = config.subWorkerConfig;
		this.semaphore = new Semaphore({
			concurrency: this.maxWorkers,
			timeout: config.timeout || 30000,
		});

		// Pre-spawn all workers eagerly so they're ready when the
		// first request arrives.
		this.spawnReady = this.prespawnWorkers();
	}

	private async prespawnWorkers(): Promise<void> {
		const spawns: Promise<PooledWorker>[] = [];
		for (let i = 0; i < this.maxWorkers; i++) {
			spawns.push(this.spawnWorker());
		}
		await Promise.all(spawns);
		logger.log(
			`[WorkerPool] All ${this.maxWorkers} workers pre-spawned and ready`
		);
	}

	async getPrimaryPhp(): Promise<PHP> {
		return this.primaryPhp;
	}

	async acquirePHPInstance(): Promise<AcquiredPHP> {
		// Wait for pre-spawned workers to be ready before acquiring.
		await this.spawnReady;

		let releaseSemaphore: () => void;
		try {
			releaseSemaphore = await this.semaphore.acquire();
		} catch (error) {
			if (error instanceof AcquireTimeoutError) {
				throw new MaxPhpInstancesError(this.maxWorkers);
			}
			throw error;
		}

		let pooledWorker: PooledWorker;
		try {
			pooledWorker = await this.getOrSpawnWorker();
		} catch (error) {
			releaseSemaphore();
			throw error;
		}

		pooledWorker.busy = true;

		const workerId = pooledWorker.id;
		// eslint-disable-next-line no-console
		console.log(`[WorkerPool] Worker #${workerId} acquired`);

		return {
			// Cast the proxy to PHP. PHPRequestHandler's #dispatchToPHP
			// only calls php.run() which our proxy implements.
			php: pooledWorker.proxy as unknown as PHP,
			reap: () => {
				// eslint-disable-next-line no-console
				console.log(`[WorkerPool] Worker #${workerId} released`);
				pooledWorker.busy = false;
				this.idleWorkers.push(pooledWorker);
				releaseSemaphore();
			},
		};
	}

	/**
	 * Get an idle sub-worker or spawn a new one if the pool isn't full.
	 */
	private async getOrSpawnWorker(): Promise<PooledWorker> {
		if (this.idleWorkers.length > 0) {
			return this.idleWorkers.pop()!;
		}
		if (this.workers.length < this.maxWorkers) {
			return await this.spawnWorker();
		}
		// This shouldn't happen because the semaphore limits concurrency,
		// but handle it gracefully.
		throw new Error(
			'No idle workers available and pool is at capacity'
		);
	}

	/**
	 * Spawn a new sub-worker, wait for it to load, and initialize it
	 * with the same configuration as the primary PHP instance.
	 */
	private async spawnWorker(): Promise<PooledWorker> {
		logger.log('[WorkerPool] Spawning sub-worker...');

		const worker = new Worker(
			new URL('./php-sub-worker.ts', import.meta.url),
			{ type: 'module' }
		);

		// Wait for the worker script to load
		await new Promise<void>((resolve, reject) => {
			const onMessage = (event: MessageEvent) => {
				if (event.data?.type === 'worker-script-started') {
					worker.removeEventListener('message', onMessage);
					worker.removeEventListener('error', onError);
					resolve();
				}
			};
			const onError = (event: ErrorEvent) => {
				worker.removeEventListener('message', onMessage);
				worker.removeEventListener('error', onError);
				reject(new Error(`Sub-worker failed to load: ${event.message}`));
			};
			worker.addEventListener('message', onMessage);
			worker.addEventListener('error', onError);
		});

		const proxy = new SubWorkerPHPProxy(worker);
		const id = this.nextWorkerId++;
		const pooledWorker: PooledWorker = { proxy, worker, busy: false, id };

		// Set up handler for spawn handler callbacks from the sub-worker.
		// When a sub-worker's PHP calls proc_open, the spawn handler
		// requests a PHP instance from the coordinator's pool.
		this.setupSpawnHandlerProxy(pooledWorker);

		// Initialize the sub-worker with the same PHP config as the primary
		await proxy.call('initialize', this.subWorkerConfig);

		this.workers.push(pooledWorker);
		this.idleWorkers.push(pooledWorker);

		logger.log(
			`[WorkerPool] Sub-worker spawned (${this.workers.length}/${this.maxWorkers})`
		);

		return pooledWorker;
	}

	/**
	 * Set up the message handler that proxies spawn handler calls from
	 * a sub-worker back to the coordinator's pool. When a sub-worker's
	 * PHP calls proc_open(), it needs to acquire a PHP instance from
	 * the global pool — which means routing back through us.
	 */
	private setupSpawnHandlerProxy(pooledWorker: PooledWorker) {
		pooledWorker.worker.addEventListener(
			'message',
			async (event: MessageEvent) => {
				const msg = event.data;
				if (!msg) return;

				if (msg.type === 'acquirePHPInstance') {
					try {
						const acquired = await this.acquirePHPInstance();
						const instanceId = this.spawnInstanceIdCounter++;

						// Store the acquired instance so we can proxy
						// calls to it and eventually reap it.
						this.activeSpawnInstances.set(instanceId, acquired);

						pooledWorker.worker.postMessage({
							type: 'acquirePHPInstanceResponse',
							instanceId,
						});
					} catch (e: any) {
						pooledWorker.worker.postMessage({
							type: 'acquirePHPInstanceResponse',
							error: e?.message || String(e),
						});
					}
				}

				if (msg.type === 'reapPHPInstance') {
					const acquired = this.activeSpawnInstances.get(
						msg.instanceId
					);
					if (acquired) {
						acquired.reap();
						this.activeSpawnInstances.delete(msg.instanceId);
					}
				}

				if (msg.type === 'coordinatorCall') {
					const { id, method, args } = msg;
					try {
						const result = await this.handleCoordinatorCall(
							method,
							args
						);
						pooledWorker.worker.postMessage({
							type: 'coordinatorResponse',
							id,
							value: result,
						});
					} catch (e: any) {
						pooledWorker.worker.postMessage({
							type: 'coordinatorResponse',
							id,
							error: e?.message || String(e),
						});
					}
				}
			}
		);
	}

	private spawnInstanceIdCounter = 0;
	private activeSpawnInstances = new Map<number, AcquiredPHP>();

	/**
	 * Handle a proxied call from a sub-worker's spawn handler to
	 * a PHP instance that was acquired from the pool.
	 */
	private async handleCoordinatorCall(
		method: string,
		args: any
	): Promise<any> {
		const acquired = this.activeSpawnInstances.get(args.instanceId);
		if (!acquired) {
			throw new Error(
				`No active spawn instance with id ${args.instanceId}`
			);
		}
		const php = acquired.php;

		switch (method) {
			case 'proxyCliCall':
				return await php.cli(args.args, args.options);
			case 'proxyChdir':
				php.chdir(args.path);
				return;
			case 'proxyCwd':
				return php.cwd();
			case 'proxyListFiles':
				return php.listFiles(args.path, args.options);
			default:
				throw new Error(`Unknown coordinator call: ${method}`);
		}
	}

	/**
	 * Forward a defineConstant call to all spawned sub-workers so
	 * that constants set after boot (e.g. the login step's
	 * PLAYGROUND_AUTO_LOGIN_AS_USER) are available in every worker.
	 */
	async defineConstant(
		key: string,
		value: string | boolean | number | null
	) {
		await this.spawnReady;
		await Promise.all(
			this.workers.map((w) => w.proxy.call('defineConstant', key, value))
		);
	}

	async [Symbol.asyncDispose]() {
		for (const pooledWorker of this.workers) {
			try {
				await pooledWorker.proxy.exit();
			} catch {
				// Worker may have already crashed
			}
			pooledWorker.worker.terminate();
		}
		this.workers = [];
		this.idleWorkers = [];

		// Reap any outstanding spawn instances
		for (const acquired of this.activeSpawnInstances.values()) {
			acquired.reap();
		}
		this.activeSpawnInstances.clear();
	}
}
