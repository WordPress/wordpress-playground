import { build } from 'esbuild';
import { MessageChannel, type MessagePort, Worker } from 'node:worker_threads';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	consumeAPI,
	consumeAPISync,
	defineAPITransferPolicy,
	exposeAPI,
	exposeSyncAPI,
	releaseApiProxy,
	type APITransferPolicy,
	RemoteAPIEndpointTerminatedError,
} from '../lib/api';
import { StreamedPHPResponse } from '../lib/php-response';

/**
 * These tests pin down the trap behind
 * https://github.com/WordPress/wordpress-playground/issues/3783.
 *
 * The Playground CLI handed a spawned PHP worker its parent's file lock manager
 * *proxy* where a MessagePort was expected. Comlink serialized the proxy onto a
 * port backed by an asynchronous `expose()`, and `consumeAPISync()` accepted it
 * without complaint — because a Comlink proxy answers every property access
 * with a proxied function, it duck-types as an endpoint.
 *
 * The child therefore appeared to boot correctly and only failed on the first
 * synchronous call, five seconds later, on another thread. `consumeAPISync()`
 * must reject the bad endpoint at the point of the mistake instead.
 */
describe('consumeAPISync() endpoint validation', () => {
	it('accepts a real MessagePort', async () => {
		const { port1, port2 } = new MessageChannel();
		await exposeSyncAPI({ ping: () => 'pong' }, port1);

		await expect(consumeAPISync(port2)).resolves.toBeDefined();

		port1.close();
		port2.close();
	});

	it('rejects a Comlink proxy passed in place of a MessagePort', async () => {
		const { port1, port2 } = new MessageChannel();
		await exposeSyncAPI({ ping: () => 'pong' }, port1);
		const proxy = await consumeAPISync<{ ping: () => string }>(port2);

		// This is exactly what the CLI's spawn path used to do. Before the
		// guard it resolved, and every later call timed out after 5 seconds.
		await expect(consumeAPISync(proxy as any)).rejects.toThrow(
			/expects a MessagePort but received a Comlink proxy/
		);

		port1.close();
		port2.close();
	});

	it.each([
		['null', null],
		['undefined', undefined],
		['a plain object', {}],
	])('rejects %s', async (_label, value) => {
		await expect(consumeAPISync(value as any)).rejects.toThrow(
			/expects a MessagePort/
		);
	});

	it('does not identify an arbitrary function as a Comlink proxy', async () => {
		await expect(consumeAPISync((() => undefined) as any)).rejects.toThrow(
			'consumeAPISync() expects a MessagePort but received function.'
		);
	});
});

describe('consumeAPI() endpoint lifecycle', () => {
	it('rejects a pending call when its Node MessagePort closes', async () => {
		const { port1, port2 } = new MessageChannel();
		exposeAPI(
			{
				waitForever: () => new Promise<void>(() => undefined),
			},
			undefined,
			port1
		);
		const api = consumeAPI<{
			waitForever(): Promise<void>;
		}>(port2);

		const pendingCall = api.waitForever();
		port1.close();

		await expect(pendingCall).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		port2.close();
	});

	it('rejects a pending remote property read when its endpoint closes', async () => {
		const { port1, port2 } = new MessageChannel();
		exposeAPI(
			{
				get value() {
					return new Promise<string>(() => undefined);
				},
			},
			undefined,
			port1
		);
		const api = consumeAPI<{
			value: Promise<string>;
		}>(port2);

		const pendingRead = api.value;
		port1.close();

		await expect(pendingRead).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		port2.close();
	});

	it('uses a provided termination signal when the transport has none', async () => {
		const { port1, port2 } = new MessageChannel();
		let signalTermination!: () => void;
		const endpointTerminated = new Promise<void>((resolve) => {
			signalTermination = resolve;
		});
		exposeAPI(
			{
				waitForever: () => new Promise<void>(() => undefined),
			},
			undefined,
			port1
		);
		const api = consumeAPI<{
			waitForever(): Promise<void>;
		}>(port2, undefined, undefined, { endpointTerminated });

		const pendingCall = api.waitForever();
		signalTermination();

		await expect(pendingCall).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		port1.close();
		port2.close();
	});

	it('interrupts streams and exit codes returned before termination', async () => {
		const { port1, port2 } = new MessageChannel();
		let signalTermination!: () => void;
		const endpointTerminated = new Promise<void>((resolve) => {
			signalTermination = resolve;
		});
		const streamThatNeverProducesData = () =>
			new ReadableStream<Uint8Array>();
		exposeAPI(
			{
				run: () =>
					new StreamedPHPResponse(
						streamThatNeverProducesData(),
						streamThatNeverProducesData(),
						streamThatNeverProducesData(),
						new Promise<number>(() => undefined)
					),
			},
			undefined,
			port1
		);
		const api = consumeAPI<{
			run(): Promise<StreamedPHPResponse>;
		}>(port2, undefined, undefined, { endpointTerminated });

		const response = await api.run();
		const stdout = response.stdout.getReader().read();
		signalTermination();

		await expect(stdout).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await expect(response.exitCode).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		port1.close();
		port2.close();
	});
});

describe('MessagePort transfer handling', () => {
	it('requires policies for collections and deeply nested ports', () => {
		type TransferApi = {
			sendMap(value: Map<string, MessagePort>): void;
			receiveSet(): Promise<Set<MessagePort>>;
			sendDeeplyNested(value: {
				one: {
					two: {
						three: {
							four: {
								five: {
									six: {
										seven: {
											port: MessagePort;
										};
									};
								};
							};
						};
					};
				};
			}): void;
		};
		type ConsumeArguments = Parameters<typeof consumeAPI<TransferApi>>;

		expectTypeOf<[MessagePort]>().not.toMatchTypeOf<ConsumeArguments>();
		expectTypeOf<
			[MessagePort, undefined, APITransferPolicy<TransferApi>]
		>().toMatchTypeOf<ConsumeArguments>();
	});

	it('applies explicit transfer policies to nested results and method arguments', async () => {
		const apiChannel = new MessageChannel();
		const phpChannel = new MessageChannel();
		const fileLockManagerChannel = new MessageChannel();
		const childWorkerServiceChannel = new MessageChannel();
		const consumerWorker = await createMessagePortConsumerWorker();
		type TransferTestApi = {
			createChildWorker(): {
				phpPort: MessagePort;
				fileLockManagerPort: MessagePort;
				workerConfig: {
					processId: number;
					childWorkerServicePort: MessagePort;
				};
			};
			workers: {
				register(config: {
					transport: {
						port: MessagePort;
						buffer: ArrayBuffer;
					};
				}): void;
			};
		};
		const transferPolicy = defineAPITransferPolicy<TransferTestApi>({
			createChildWorker: {
				result(child) {
					return [
						child.phpPort,
						child.fileLockManagerPort,
						child.workerConfig.childWorkerServicePort,
					];
				},
			},
			workers: {
				register: {
					arguments(config) {
						return [
							config.transport.port,
							config.transport.buffer,
							// Policies may discover the same backing buffer through
							// multiple views. The transport deduplicates by identity.
							config.transport.buffer,
						];
					},
				},
			},
		});
		const [setReady] = exposeAPI(
			{
				createChildWorker: () => ({
					phpPort: phpChannel.port1,
					fileLockManagerPort: fileLockManagerChannel.port1,
					workerConfig: {
						processId: 123,
						childWorkerServicePort: childWorkerServiceChannel.port1,
					},
				}),
				workers: {
					register(config: {
						transport: {
							port: MessagePort;
							buffer: ArrayBuffer;
						};
					}) {
						config.transport.port.postMessage(
							`nested argument buffer length ${config.transport.buffer.byteLength}`
						);
						config.transport.port.close();
					},
				},
			},
			undefined,
			apiChannel.port1,
			transferPolicy
		);
		setReady();
		const messagesFromConsumerWorker = Promise.all([
			new Promise((resolve) => phpChannel.port2.once('message', resolve)),
			new Promise((resolve) =>
				fileLockManagerChannel.port2.once('message', resolve)
			),
			new Promise((resolve) =>
				childWorkerServiceChannel.port2.once('message', resolve)
			),
			new Promise((resolve) => {
				consumerWorker.on(
					'message',
					function resolveNestedTransfer(message) {
						if (message?.type === 'nested-transfer-complete') {
							resolve(message.value);
						}
					}
				);
			}),
		]);
		const consumerWorkerError =
			rejectWhenConsumerWorkerFails(consumerWorker);

		try {
			consumerWorker.postMessage({ apiPort: apiChannel.port2 }, [
				apiChannel.port2,
			]);
			await expect(
				Promise.race([messagesFromConsumerWorker, consumerWorkerError])
			).resolves.toEqual([
				'php port',
				'file lock manager port',
				'child worker service port for process 123',
				'nested argument buffer length 8; sender buffer length 0',
			]);
		} finally {
			apiChannel.port1.close();
			phpChannel.port2.close();
			fileLockManagerChannel.port2.close();
			childWorkerServiceChannel.port2.close();
			await consumerWorker.terminate();
		}
	});

	it('combines policies with existing top-level transfer handlers', async () => {
		type TransferTestApi = {
			createPort(): MessagePort;
		};
		const apiChannel = new MessageChannel();
		const resourceChannel = new MessageChannel();
		const transferPolicy = defineAPITransferPolicy<TransferTestApi>({
			createPort: {
				result(port) {
					return [port, port];
				},
			},
		});
		const [setReady] = exposeAPI<TransferTestApi, undefined>(
			{
				createPort() {
					return resourceChannel.port1;
				},
			},
			undefined,
			apiChannel.port1,
			transferPolicy
		);
		setReady();
		const api = consumeAPI<TransferTestApi>(
			apiChannel.port2,
			undefined,
			transferPolicy
		);
		const messageReceived = new Promise((resolve) =>
			resourceChannel.port2.once('message', resolve)
		);

		const transferredPort = await api.createPort();
		transferredPort.postMessage('transferred');
		await expect(messageReceived).resolves.toBe('transferred');

		transferredPort.close();
		resourceChannel.port2.close();
		apiChannel.port1.close();
		apiChannel.port2.close();
	});

	it('preserves method errors without invoking a result transfer hook', async () => {
		type FailingApi = {
			createResource(): { port: MessagePort };
		};
		let resultHookCalled = false;
		const transferPolicy = defineAPITransferPolicy<FailingApi>({
			createResource: {
				result(resource) {
					resultHookCalled = true;
					return [resource.port];
				},
			},
		});
		const apiChannel = new MessageChannel();
		const [setReady] = exposeAPI<FailingApi, undefined>(
			{
				createResource() {
					throw new Error('resource creation failed');
				},
			},
			undefined,
			apiChannel.port1,
			transferPolicy
		);
		setReady();
		const api = consumeAPI<FailingApi>(
			apiChannel.port2,
			undefined,
			transferPolicy
		);

		await expect(api.createResource()).rejects.toThrow(
			'resource creation failed'
		);
		expect(resultHookCalled).toBe(false);
		apiChannel.port1.close();
		apiChannel.port2.close();
	});

	it('rejects the remote call when a result transfer hook fails', async () => {
		type FailingPolicyApi = {
			createResource(): { port: MessagePort };
		};
		const transferPolicy = defineAPITransferPolicy<FailingPolicyApi>({
			createResource: {
				result() {
					throw new Error('transfer policy failed');
				},
			},
		});
		const resourceChannel = new MessageChannel();
		const apiChannel = new MessageChannel();
		const [setReady] = exposeAPI<FailingPolicyApi, undefined>(
			{
				createResource() {
					return { port: resourceChannel.port1 };
				},
			},
			undefined,
			apiChannel.port1,
			transferPolicy
		);
		setReady();
		const api = consumeAPI<FailingPolicyApi>(
			apiChannel.port2,
			undefined,
			transferPolicy
		);

		await expect(api.createResource()).rejects.toThrow(
			'transfer policy failed'
		);
		apiChannel.port1.close();
		apiChannel.port2.close();
		resourceChannel.port1.close();
		resourceChannel.port2.close();
	});
});

describe('piped API forwarding', () => {
	it('preserves a consumed proxy and applies only its declared result policy', async () => {
		type PipedApi = {
			absoluteUrl: string;
			stringifyDate(date: Date): string;
			createPort(): { port: MessagePort };
		};
		const transferPolicy = defineAPITransferPolicy<PipedApi>({
			createPort: {
				result(resource) {
					return [resource.port];
				},
			},
		});
		const innerApiChannel = new MessageChannel();
		const outerApiChannel = new MessageChannel();
		const resourceChannel = new MessageChannel();
		const [setInnerReady] = exposeAPI<PipedApi, undefined>(
			{
				absoluteUrl: 'https://playground.wordpress.net/',
				stringifyDate(date) {
					return date.toISOString();
				},
				createPort() {
					return { port: resourceChannel.port1 };
				},
			},
			undefined,
			innerApiChannel.port1,
			transferPolicy
		);
		setInnerReady();
		const innerApi = consumeAPI<PipedApi>(
			innerApiChannel.port2,
			undefined,
			transferPolicy
		);
		const [setOuterReady] = exposeAPI(
			{},
			innerApi,
			outerApiChannel.port1,
			transferPolicy
		);
		setOuterReady();
		const outerApi = consumeAPI<PipedApi>(
			outerApiChannel.port2,
			undefined,
			transferPolicy
		);
		const resourceMessage = new Promise(function receiveResourceMessage(
			resolve
		) {
			resourceChannel.port2.once('message', resolve);
		});

		try {
			await expect(outerApi.absoluteUrl).resolves.toBe(
				'https://playground.wordpress.net/'
			);
			await expect(
				outerApi.stringifyDate(new Date('2026-07-28T12:00:00.000Z'))
			).resolves.toBe('2026-07-28T12:00:00.000Z');
			const resource = await outerApi.createPort();
			resource.port.postMessage('forwarded');
			await expect(resourceMessage).resolves.toBe('forwarded');
			resource.port.close();
		} finally {
			outerApi[releaseApiProxy]();
			innerApi[releaseApiProxy]();
			innerApiChannel.port1.close();
			innerApiChannel.port2.close();
			outerApiChannel.port1.close();
			outerApiChannel.port2.close();
			resourceChannel.port2.close();
		}
	});
});

async function createMessagePortConsumerWorker(): Promise<Worker> {
	const workerBuild = await build({
		bundle: true,
		format: 'esm',
		platform: 'node',
		target: 'node22',
		write: false,
		stdin: {
			loader: 'js',
			resolveDir: import.meta.dirname,
			sourcefile: 'message-port-consumer.worker.mjs',
			contents: `
		import { MessageChannel, parentPort } from 'node:worker_threads';
		import {
			consumeAPI,
			defineAPITransferPolicy,
		} from '../lib/api.ts';

		const transferPolicy = defineAPITransferPolicy({
			createChildWorker: {
				result(child) {
					return [
						child.phpPort,
						child.fileLockManagerPort,
						child.workerConfig.childWorkerServicePort,
					];
				},
			},
			workers: {
				register: {
					arguments(config) {
						return [
							config.transport.port,
							config.transport.buffer,
							// Exercise transfer-list identity deduplication in the
							// bundled consumer as well as the typed main-thread policy.
							config.transport.buffer,
						];
					},
				},
			},
		});

		parentPort.once('message', async function consumeApi({ apiPort }) {
			try {
				const api = consumeAPI(apiPort, undefined, transferPolicy);
				const child = await api.createChildWorker();
				child.phpPort.postMessage('php port');
				child.fileLockManagerPort.postMessage(
					'file lock manager port'
				);
				child.workerConfig.childWorkerServicePort.postMessage(
					'child worker service port for process ' +
						child.workerConfig.processId
				);
				child.phpPort.close();
				child.fileLockManagerPort.close();
				child.workerConfig.childWorkerServicePort.close();
				const argumentChannel = new MessageChannel();
				const buffer = new ArrayBuffer(8);
				const nestedArgumentReceived = new Promise((resolve) => {
					argumentChannel.port2.once('message', resolve);
				});
				await api.workers.register({
					transport: {
						port: argumentChannel.port1,
						buffer,
					},
				});
				parentPort.postMessage({
					type: 'nested-transfer-complete',
					value:
						(await nestedArgumentReceived) +
						'; sender buffer length ' +
						buffer.byteLength,
				});
				argumentChannel.port2.close();
			} catch (error) {
				parentPort.postMessage({
					type: 'error',
					message: error instanceof Error ? error.stack : String(error),
				});
			}
		});
			`,
		},
	});
	const workerSource = workerBuild.outputFiles[0].text;
	return new Worker(
		new URL(`data:text/javascript,${encodeURIComponent(workerSource)}`)
	);
}

function rejectWhenConsumerWorkerFails(worker: Worker): Promise<never> {
	return new Promise<never>((_resolve, reject) => {
		worker.once('error', reject);
		worker.on('message', function rejectReportedWorkerError(message) {
			if (message?.type === 'error') {
				reject(new Error(message.message));
			}
		});
	});
}
