import { streamToPort } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import type {
	PlaygroundWorkerEndpoint,
	WorkerBootOptions,
} from './playground-worker-endpoint';

export const RELOAD_REQUIRED = 'playground-reload-required';
export const RUNTIME_CLOSED = 'playground-runtime-closed';

/** One runtime per site; connected documents never own its lifetime. */
export class SharedRuntime {
	private bootPromise?: Promise<void>;
	private initialized: Promise<void>;
	private initializer?: MessagePort;
	private initializationComplete = false;
	private resolveInitialization!: () => void;
	private rejectInitialization!: (error: Error) => void;
	private active = new Set<Promise<unknown>>();
	private retiring?: Promise<void>;
	private retired = false;
	private closed = false;
	private runtimeId = crypto.randomUUID();
	private ports = new Set<MessagePort>();
	private servicePorts = new Set<MessagePort>();
	private readiness = new Set<{
		ready: () => void;
		failed: (error: Error) => void;
	}>();

	constructor(
		endpoint: PlaygroundWorkerEndpoint,
		version: string,
		onClose: () => void
	) {
		this.endpoint = endpoint;
		this.version = version;
		this.close = onClose;
		this.initialized = new Promise((resolve, reject) => {
			this.resolveInitialization = resolve;
			this.rejectInitialization = reject;
		});
		// Initialization can fail before another document attaches.
		void this.initialized.catch(() => {});
	}

	private endpoint: PlaygroundWorkerEndpoint;
	private version: string;
	private close: () => void;

	connect(
		port: MessagePort,
		ready: () => void,
		failed: (error: Error) => void
	) {
		this.ports.add(port);
		this.readiness.add({ ready, failed });
		port.addEventListener('message', (event) => {
			if (event.data?.type === 'shared-runtime-connect') {
				if (event.data.buildVersion !== this.version || this.retired) {
					port.postMessage({
						type: RELOAD_REQUIRED,
						ready: this.closed,
					});
					void this.retire().catch((error) => {
						for (const connection of this.ports)
							connection.postMessage({
								type: 'shared-runtime-retirement-error',
								error: String(error),
							});
					});
				} else if (event.data.clientBuildVersion !== this.version) {
					port.postMessage({ type: RELOAD_REQUIRED, ready: true });
				} else {
					port.postMessage({
						type: 'shared-runtime-connected',
						runtimeId: this.runtimeId,
					});
				}
			} else if (event.data?.type === 'shared-runtime-disconnect') {
				this.ports.delete(port);
				this.readiness.delete(
					[...this.readiness].find((item) => item.ready === ready)!
				);
				port.close();
				if (port === this.initializer && !this.initializationComplete) {
					void this.retire().catch(() => {});
				}
			}
		});
		port.start();
		if (this.bootPromise) {
			void this.bootPromise.then(ready, failed);
		}
	}

	registerServicePort(port: MessagePort) {
		this.servicePorts.add(port);
	}

	/** Serves HTTP once through a direct port and keeps retirement waiting for the body. */
	handleServiceWorkerRequest(
		message: { method: string; args: any[]; requestId: number },
		port: MessagePort
	) {
		return this.run(async () => {
			if (message.method === 'request') {
				const response = await this.endpoint.requestStreamed(
					message.args[0]
				);
				const httpStatusCode = await response.httpStatusCode;
				const headers = await response.headers;
				const body = new TransformStream<Uint8Array, Uint8Array>();
				const drained = response.stdout.pipeTo(body.writable);
				const bodyPort = streamToPort(body.readable);
				port.postMessage(
					responseTo(message.requestId, {
						httpStatusCode,
						headers,
						bodyPort,
					}),
					[bodyPort]
				);
				try {
					await drained;
				} finally {
					// Cancelling a response body does not imply PHP has finished writing.
					await response.exitCode;
				}
			} else {
				const method = message.method as keyof PlaygroundWorkerEndpoint;
				const result = await (
					this.endpoint[method] as (...args: any[]) => any
				).apply(this.endpoint, message.args);
				port.postMessage(responseTo(message.requestId, result));
			}
		});
	}

	api(port?: MessagePort) {
		return new Proxy(this.endpoint, {
			has: (target, property) =>
				[
					'beginSharedBoot',
					'finishSharedRuntimeInitialization',
					'shutdownSharedRuntime',
				].includes(String(property)) || Reflect.has(target, property),
			get: (target, property) => {
				if (property === 'shutdownSharedRuntime')
					return () => this.retire();
				if (property === 'beginSharedBoot') {
					return (options: WorkerBootOptions) =>
						this.beginBoot(options, port);
				}
				if (property === 'finishSharedRuntimeInitialization') {
					return () => {
						if (port !== this.initializer)
							throw new Error(
								'Only the initializing connection can complete startup.'
							);
						this.initializationComplete = true;
						// A failed Blueprint still leaves a usable PHP client for recovery tools.
						this.resolveInitialization();
					};
				}
				const value = Reflect.get(target, property, target);
				if (typeof value !== 'function') return value;
				return (...args: unknown[]) =>
					this.run(() => value.apply(target, args));
			},
		});
	}

	async retire() {
		if (this.retiring) return this.retiring;
		// Set the gate before notifying ports or awaiting any operation.
		this.retired = true;

		this.retiring = Promise.resolve()
			.then(async () => {
				this.rejectInitialization(new Error(RELOAD_REQUIRED));
				for (const port of [...this.ports, ...this.servicePorts]) {
					port.postMessage({ type: 'shared-runtime-retired' });
				}
				await Promise.allSettled([...this.active]);
				for (const mountpoint of Object.keys(this.endpoint.unmounts)) {
					await this.endpoint.unmountOpfs(mountpoint);
				}
				await this.endpoint[Symbol.asyncDispose]();
				this.closed = true;

				for (const port of [...this.ports, ...this.servicePorts])
					port.postMessage({ type: RUNTIME_CLOSED });
				this.close();
			})
			.catch((error) => {
				// Permit another save attempt without accepting work on partially detached mounts.
				this.retiring = undefined;
				throw error;
			});
		return this.retiring;
	}

	private async beginBoot(
		options: WorkerBootOptions,
		port?: MessagePort
	): Promise<boolean> {
		if (this.retired) throw new Error(RELOAD_REQUIRED);
		if (this.bootPromise) {
			await this.bootPromise;
			await this.initialized;
			return false;
		}
		this.initializer = port;
		this.bootPromise = this.run(async () => {
			await this.endpoint.boot(options);
		});
		void this.bootPromise.then(
			() => {
				for (const item of this.readiness) item.ready();
			},
			(error) => {
				for (const item of this.readiness) item.failed(error);
				this.rejectInitialization(error);
				// Close the failed runtime so another document can start a fresh worker.
				void this.retire().catch(() => {});
			}
		);
		await this.bootPromise;
		return true;
	}

	private run<T>(operation: () => T | Promise<T>): Promise<T> {
		if (this.retired) return Promise.reject(new Error(RELOAD_REQUIRED));
		const promise = Promise.resolve().then(operation);
		const completion = promise.then(async (result) => {
			if (result && typeof result === 'object' && 'exitCode' in result) {
				await result.exitCode;
			}
		});
		this.active.add(completion);
		void completion
			.finally(() => this.active.delete(completion))
			.catch(() => {});
		return promise;
	}
}
