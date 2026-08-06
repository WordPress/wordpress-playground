/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {
	PHPResponse,
	RPC_PROTOCOL_MARKER,
	RPC_PROTOCOL_VERSION,
	RPCProtocolVersionMismatchError,
	RPCSerializationError,
	RemoteAPIEndpointTerminatedError,
	StreamedPHPResponse,
	consumeAPI,
	defineAPITransferPolicy,
	exposeAPI,
	phpEventStdinTransfer,
	portToStream,
	releaseApiProxy,
	streamToPort,
	type APITransferPolicy,
	type RemoteAPI,
} from '../lib';

type Pair<API> = {
	remote: RemoteAPI<API>;
	release(): Promise<void>;
};

function createPair<API extends object>(
	api: API,
	options: {
		consumeSignal?: AbortSignal;
		exposeSignal?: AbortSignal;
		consumePolicy?: APITransferPolicy;
		exposePolicy?: APITransferPolicy;
		streamTransport?: 'auto' | 'native' | 'message-port';
	} = {}
): Pair<API> {
	const channel = new MessageChannel();
	const [setReady] = exposeAPI(api, undefined, channel.port1, {
		signal: options.exposeSignal,
		transferPolicy: options.exposePolicy,
		streamTransport: options.streamTransport,
	});
	setReady();
	const remote = consumeAPI<API>(channel.port2, {
		signal: options.consumeSignal,
		transferPolicy: options.consumePolicy,
		streamTransport: options.streamTransport,
	});
	return {
		remote,
		release: () =>
			(remote as unknown as { [releaseApiProxy]: () => Promise<void> })[
				releaseApiProxy
			](),
	};
}

describe('Playground RPC', () => {
	it('calls methods and reads nested properties while preserving receivers', async () => {
		class Counter {
			value = 4;
			nested = {
				value: 7,
				read() {
					return this.value;
				},
			};

			increment(amount: number) {
				this.value += amount;
				return this.value;
			}
		}

		const pair = createPair(new Counter());
		await pair.remote.isConnected();
		await pair.remote.isReady();

		expect(await pair.remote.increment(3)).toBe(7);
		expect(await pair.remote.value).toBe(7);
		expect(await pair.remote.nested.value).toBe(7);
		expect(await pair.remote.nested.read()).toBe(7);
		await pair.release();
	});

	it('supports concurrent calls whose responses arrive out of order', async () => {
		const pair = createPair({
			async delayed(value: string, delay: number) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				return value;
			},
		});

		const completionOrder: string[] = [];
		const slow = pair.remote.delayed('slow', 30).then((value) => {
			completionOrder.push(value);
			return value;
		});
		const fast = pair.remote.delayed('fast', 0).then((value) => {
			completionOrder.push(value);
			return value;
		});

		expect(await Promise.all([slow, fast])).toEqual(['slow', 'fast']);
		expect(completionOrder).toEqual(['fast', 'slow']);
		await pair.release();
	});

	it('round-trips callbacks, callback results, errors, and returned callbacks', async () => {
		const pair = createPair({
			async invoke(
				callback: (value: number) => number | Promise<number>
			) {
				return await callback(6);
			},
			cleanup() {
				return () => 'cleaned';
			},
		});

		expect(await pair.remote.invoke(async (value) => value * 2)).toBe(12);
		await expect(
			pair.remote.invoke(() => {
				throw new TypeError('callback failed');
			})
		).rejects.toMatchObject({
			name: 'TypeError',
			message: 'callback failed',
		});

		const cleanup = await pair.remote.cleanup();
		expect(await cleanup()).toBe('cleaned');
		await cleanup[releaseApiProxy]();
		await expect(cleanup()).rejects.toThrow(/no longer available/);
		await pair.release();
	});

	it('relays an already-remote callback through a second session', async () => {
		const inner = createPair({
			async invoke(callback: (value: string) => Promise<string>) {
				return await callback('inner');
			},
		});
		const outer = createPair({
			async forward(callback: (value: string) => Promise<string>) {
				return await inner.remote.invoke(callback);
			},
		});

		expect(
			await outer.remote.forward(async (value) => `${value}-result`)
		).toBe('inner-result');
		await outer.release();
		await inner.release();
	});

	it('pipes an already-remote API with direct-method precedence and readiness', async () => {
		const inner = createPair({
			label: 'inner',
			conflict() {
				return 'inner';
			},
			nested: {
				value: 9,
				read() {
					return this.value;
				},
			},
		});
		const channel = new MessageChannel();
		const [setReady, setFailed] = exposeAPI(
			{
				conflict() {
					return 'direct';
				},
			},
			inner.remote,
			channel.port1
		);
		const remote = consumeAPI<{
			conflict(): Promise<string>;
			label: string;
			nested: { read(): Promise<number> };
		}>(channel.port2);

		await remote.isConnected();
		let readySettled = false;
		const ready = remote.isReady().finally(() => {
			readySettled = true;
		});
		await Promise.resolve();
		expect(readySettled).toBe(false);
		setReady();
		setFailed(new Error('ignored after readiness settles'));
		await ready;
		expect(await remote.conflict()).toBe('direct');
		expect(await remote.label).toBe('inner');
		expect(await remote.nested.read()).toBe(9);

		await remote[releaseApiProxy]();
		await inner.release();
	});

	it('propagates a rejected readiness state', async () => {
		const channel = new MessageChannel();
		const [, setFailed] = exposeAPI({}, undefined, channel.port1);
		const remote = consumeAPI<Record<string, never>>(channel.port2);
		setFailed(new Error('API initialization failed'));

		await expect(remote.isReady()).rejects.toMatchObject({
			message: 'API initialization failed',
		});
		await remote[releaseApiProxy]();
	});

	it('releases safely, rejects pending work, and rejects calls after release', async () => {
		const pair = createPair({
			never: () => new Promise<void>(() => {}),
			value: 1,
		});
		const pending = pair.remote.never();
		const firstRelease = pair.remote[releaseApiProxy]();
		const secondRelease = pair.remote[releaseApiProxy]();

		await expect(firstRelease).resolves.toBeUndefined();
		await expect(secondRelease).resolves.toBeUndefined();
		await expect(pending).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await expect(pair.remote.never()).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await expect(pair.remote.value).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
	});

	it('terminates method and property operations from one owner signal', async () => {
		const controller = new AbortController();
		const pair = createPair(
			{
				method: () => new Promise<void>(() => {}),
				get property() {
					return new Promise<void>(() => {});
				},
			},
			{ consumeSignal: controller.signal }
		);
		const method = pair.remote.method();
		const property = pair.remote.property;
		controller.abort(new Error('owner disposed'));

		await expect(method).rejects.toMatchObject({
			name: 'RemoteAPIEndpointTerminatedError',
			reason: 'aborted',
		});
		await expect(property).rejects.toMatchObject({
			name: 'RemoteAPIEndpointTerminatedError',
			reason: 'aborted',
		});
	});

	it('propagates exposing-owner termination to calls, paths, and streams', async () => {
		const controller = new AbortController();
		const pair = createPair(
			{
				never: () => new Promise<void>(() => {}),
				nested: { value: 1 },
				stream() {
					return new ReadableStream<Uint8Array>({
						start(streamController) {
							streamController.enqueue(new Uint8Array([1]));
						},
					});
				},
			},
			{
				exposeSignal: controller.signal,
				streamTransport: 'message-port',
			}
		);
		await pair.remote.isConnected();
		const pending = pair.remote.never();
		const derivedPath = pair.remote.nested;
		const reader = (await pair.remote.stream()).getReader();
		expect(await reader.read()).toMatchObject({ done: false });
		const pendingRead = reader.read();
		controller.abort(new Error('exposing owner stopped'));

		await expect(pending).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await expect(derivedPath.value).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await expect(pendingRead).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
	});

	it('observes Node MessagePort close while an operation is pending', async () => {
		const channel = new MessageChannel();
		const [setReady] = exposeAPI(
			{ never: () => new Promise<never>(() => {}) },
			undefined,
			channel.port1
		);
		setReady();
		const remote = consumeAPI<{ never(): Promise<never> }>(channel.port2);
		const pending = remote.never();
		channel.port1.close();
		await expect(pending).rejects.toMatchObject({
			name: 'RemoteAPIEndpointTerminatedError',
			reason: 'close',
		});
	});

	it('preserves CustomEvent details and Error metadata in both directions', async () => {
		class ExampleError extends Error {
			repoUrl = 'https://example.test/repository';
			source = 'php';
			response = new PHPResponse(503, {}, new Uint8Array(), '', 1);
		}
		const pair = createPair({
			echo(value: unknown) {
				return value;
			},
			throwValue(value: unknown) {
				throw value;
			},
		});

		const event = (await pair.remote.echo(
			new CustomEvent('progress', { detail: { loaded: 5 } })
		)) as CustomEvent;
		expect(event.type).toBe('progress');
		expect(event.detail).toEqual({ loaded: 5 });

		const error = new ExampleError('failure', {
			cause: new RangeError('root cause'),
		});
		const returned = (await pair.remote.echo(error)) as ExampleError;
		expect(returned).toMatchObject({
			name: 'Error',
			message: 'failure',
			originalErrorClassName: 'ExampleError',
			repoUrl: error.repoUrl,
			source: 'php',
		});
		expect(returned.cause).toMatchObject({
			name: 'RangeError',
			message: 'root cause',
		});
		expect(returned.response).toBeInstanceOf(PHPResponse);
		expect(returned.response.httpStatusCode).toBe(503);

		await expect(pair.remote.throwValue('not-an-error')).rejects.toBe(
			'not-an-error'
		);
		await pair.release();
	});

	it('transfers PHPResponse and MessagePort values', async () => {
		const pair = createPair({
			echo<T>(value: T): T {
				return value;
			},
		});
		const bytes = new Uint8Array([1, 2, 3]);
		const response = (await pair.remote.echo(
			new PHPResponse(201, { test: ['yes'] }, bytes, 'stderr', 2)
		)) as PHPResponse;
		expect(response).toBeInstanceOf(PHPResponse);
		expect(response.toRawData()).toMatchObject({
			httpStatusCode: 201,
			headers: { test: ['yes'] },
			errors: 'stderr',
			exitCode: 2,
		});
		expect([...response.bytes]).toEqual([1, 2, 3]);

		const channel = new MessageChannel();
		const returnedPort = (await pair.remote.echo(
			channel.port2
		)) as MessagePort;
		const message = new Promise((resolve) => {
			channel.port1.addEventListener(
				'message',
				(event) => resolve(event.data),
				{ once: true }
			);
			channel.port1.start();
		});
		returnedPort.postMessage('through-port');
		expect(await message).toBe('through-port');
		channel.port1.close();
		returnedPort.close();
		await pair.release();
	});

	it('round-trips complete StreamedPHPResponse fields in both directions', async () => {
		const pair = createPair(
			{
				echo<T>(value: T): T {
					return value;
				},
			},
			{ streamTransport: 'message-port' }
		);
		const source = StreamedPHPResponse.fromPHPResponse(
			new PHPResponse(
				202,
				{ 'x-rpc-test': ['yes'] },
				new TextEncoder().encode('stdout'),
				'stderr',
				7
			)
		);
		const response = (await pair.remote.echo(
			source
		)) as StreamedPHPResponse;

		expect(await response.httpStatusCode).toBe(202);
		expect(await response.headers).toEqual({ 'x-rpc-test': ['yes'] });
		expect(await response.stdoutText).toBe('stdout');
		expect(await response.stderrText).toBe('stderr');
		expect(await response.exitCode).toBe(7);
		await pair.release();
	});

	it.each(['auto', 'message-port'] as const)(
		'transfers ReadableStream and branded PHP stdin events using %s transport',
		async (streamTransport) => {
			const pair = createPair(
				{
					echo<T>(value: T): T {
						return value;
					},
				},
				{ streamTransport }
			);
			const stream = streamFromText('stream-data');
			const returned = (await pair.remote.echo(
				stream
			)) as ReadableStream<Uint8Array>;
			expect(await new Response(returned).text()).toBe('stream-data');

			const event = (await pair.remote.echo({
				type: 'sendmail',
				stdin: streamFromText('mail-body'),
				[phpEventStdinTransfer]: true as const,
			})) as {
				type: string;
				stdin: ReadableStream<Uint8Array>;
				[phpEventStdinTransfer]: true;
			};
			expect(event[phpEventStdinTransfer]).toBe(true);
			expect(await new Response(event.stdin).text()).toBe('mail-body');
			await pair.release();
		}
	);

	it('round-trips and cancels streams through the public port helpers', async () => {
		let cancelReason: unknown;
		const cancelled = new Promise<void>((resolve) => {
			const source = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('first'));
				},
				cancel(reason) {
					cancelReason = reason;
					resolve();
				},
			});
			const reader = portToStream(streamToPort(source)).getReader();
			void (async () => {
				expect(
					new TextDecoder().decode((await reader.read()).value)
				).toBe('first');
				await reader.cancel('consumer stopped');
			})();
		});
		await cancelled;
		expect(cancelReason).toBe(
			'The remote stream consumer cancelled the stream.'
		);

		const complete = portToStream(streamToPort(streamFromText('complete')));
		expect(await new Response(complete).text()).toBe('complete');

		const failed = portToStream(
			streamToPort(
				new ReadableStream({
					start(controller) {
						controller.error(new RangeError('stream failed'));
					},
				})
			)
		);
		await expect(failed.getReader().read()).rejects.toMatchObject({
			name: 'RangeError',
			message: 'stream failed',
		});
	});

	it.each(['message-port', 'native'] as const)(
		'errors returned streams and every deferred response field on termination with %s transport',
		async (streamTransport) => {
			const controller = new AbortController();
			const never = new Promise<number>(() => {});
			const openStream = (first: string) =>
				new ReadableStream<Uint8Array>({
					start(streamController) {
						streamController.enqueue(
							new TextEncoder().encode(first)
						);
					},
				});
			const pair = createPair(
				{
					stream() {
						return openStream('standalone');
					},
					response() {
						return new StreamedPHPResponse(
							openStream('{"status":200,"headers":[]}'),
							openStream('stdout'),
							openStream('stderr'),
							never
						);
					},
				},
				{ consumeSignal: controller.signal, streamTransport }
			);

			const stream = await pair.remote.stream();
			const reader = stream.getReader();
			expect(await reader.read()).toMatchObject({ done: false });
			const pendingRead = reader.read();
			const response = await pair.remote.response();
			const headersReader = response.getHeadersStream().getReader();
			const stdoutReader = response.stdout.getReader();
			const stderrReader = response.stderr.getReader();
			expect(await headersReader.read()).toMatchObject({ done: false });
			expect(await stdoutReader.read()).toMatchObject({ done: false });
			expect(await stderrReader.read()).toMatchObject({ done: false });
			const pendingHeaders = headersReader.read();
			const pendingStdout = stdoutReader.read();
			const pendingStderr = stderrReader.read();
			controller.abort();

			for (const pendingStreamRead of [
				pendingRead,
				pendingHeaders,
				pendingStdout,
				pendingStderr,
			]) {
				await expect(pendingStreamRead).rejects.toBeInstanceOf(
					RemoteAPIEndpointTerminatedError
				);
			}
			await expect(response.exitCode).rejects.toBeInstanceOf(
				RemoteAPIEndpointTerminatedError
			);
		}
	);

	it('associates exact, deduplicated transfer-policy lists with an API', async () => {
		const policy = defineAPITransferPolicy({
			transferArguments(path, args) {
				return path.join('.') === 'inspect'
					? [
							(args[0] as { buffer: ArrayBuffer }).buffer,
							(args[0] as { buffer: ArrayBuffer }).buffer,
						]
					: [];
			},
			transferResult(path, result) {
				return path.join('.') === 'make'
					? [(result as { buffer: ArrayBuffer }).buffer]
					: [];
			},
		});
		const api = defineAPITransferPolicy(
			{
				inspect(value: { buffer: ArrayBuffer }) {
					return value.buffer.byteLength;
				},
				make() {
					return { buffer: new ArrayBuffer(8) };
				},
			},
			policy
		);
		const pair = createPair(api, { consumePolicy: policy });
		const argument = { buffer: new ArrayBuffer(4) };
		expect(await pair.remote.inspect(argument)).toBe(4);
		expect(argument.buffer.byteLength).toBe(0);
		const result = await pair.remote.make();
		expect(result.buffer.byteLength).toBe(8);
		await pair.release();
	});

	it('rejects an uncloneable argument without poisoning the session', async () => {
		const pair = createPair({
			echo(value: unknown) {
				return value;
			},
			ping() {
				return 'pong';
			},
		});

		await expect(
			pair.remote.echo({ nested: new WeakMap() })
		).rejects.toBeInstanceOf(RPCSerializationError);
		expect(await pair.remote.ping()).toBe('pong');
		await pair.release();
	});

	it('fails a recognized protocol-version mismatch explicitly', async () => {
		const channel = new MessageChannel();
		channel.port2.addEventListener('message', (event) => {
			const hello = event.data;
			if (
				hello?.protocol === RPC_PROTOCOL_MARKER &&
				hello?.kind === 'hello'
			) {
				channel.port2.postMessage({
					protocol: RPC_PROTOCOL_MARKER,
					version: RPC_PROTOCOL_VERSION,
					session: hello.session,
					kind: 'protocol-error',
					remoteVersion: RPC_PROTOCOL_VERSION + 1,
				});
			}
		});
		channel.port2.start();
		const remote = consumeAPI<{ ping(): Promise<void> }>(channel.port1);

		await expect(remote.isConnected()).rejects.toBeInstanceOf(
			RPCProtocolVersionMismatchError
		);
		await expect(remote.ping()).rejects.toBeInstanceOf(
			RPCProtocolVersionMismatchError
		);
		channel.port2.close();
	});
});

function streamFromText(text: string): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		},
	});
}
