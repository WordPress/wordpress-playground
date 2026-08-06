/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { EventEmitter } from 'node:events';
import {
	RPC_PROTOCOL_MARKER,
	RPC_PROTOCOL_VERSION,
	RPCSerializationError,
	RPCUnsupportedTransferError,
	RemoteAPIEndpointTerminatedError,
	consumeAPI,
	exposeAPI,
	releaseApiProxy,
	type NodeProcess,
} from '../lib';

describe('Playground RPC protocol validation', () => {
	it('reports the exposing endpoint version to a mismatched peer', async () => {
		const channel = new MessageChannel();
		exposeAPI({}, undefined, channel.port1);
		const inbox = createPortInbox(channel.port2);
		channel.port2.postMessage({
			...envelope('version-check-session', 'hello'),
			version: RPC_PROTOCOL_VERSION + 1,
		});

		const response = await inbox.take(
			(message) => message?.kind === 'protocol-error'
		);
		expect(response.version).toBe(RPC_PROTOCOL_VERSION);
		expect(response.remoteVersion).toBe(RPC_PROTOCOL_VERSION);
		channel.port2.close();
	});

	it('ignores malformed protocol errors during the handshake', async () => {
		const channel = new MessageChannel();
		channel.port2.addEventListener('message', (event) => {
			const hello = event.data;
			if (hello?.kind !== 'hello') return;
			channel.port2.postMessage({
				...envelope(hello.session, 'protocol-error'),
			});
			channel.port2.postMessage({
				...envelope(hello.session, 'protocol-error'),
				remoteVersion: RPC_PROTOCOL_VERSION + 1,
				message: 42,
			});
			channel.port2.postMessage(envelope(hello.session, 'hello-ack'));
		});
		channel.port2.start();
		const remote = consumeAPI(channel.port1);

		await expect(remote.isConnected()).resolves.toBeUndefined();
		await remote[releaseApiProxy]();
		channel.port2.close();
	});

	it('ignores unrelated and forged traffic and rejects hostile requests', async () => {
		const channel = new MessageChannel();
		let calls = 0;
		exposeAPI(
			{
				increment(value: number) {
					calls++;
					return value + 1;
				},
			},
			undefined,
			channel.port1
		);
		const inbox = createPortInbox(channel.port2);
		const session = 'raw-session-0001';
		channel.port2.postMessage(envelope(session, 'hello'));
		await inbox.take((message) => message?.kind === 'hello-ack');

		channel.port2.postMessage('worker-script-started');
		channel.port2.postMessage({ protocol: RPC_PROTOCOL_MARKER });
		channel.port2.postMessage({
			...envelope('forged-session-0001', 'request'),
			requestId: 'forged',
			operation: 'call',
			path: ['increment'],
			args: [cloneValue(1)],
		});
		channel.port2.postMessage({
			...envelope(session, 'request'),
			requestId: 'dangerous',
			operation: 'get',
			path: ['__proto__'],
			args: [],
		});
		const dangerous = await inbox.take(
			(message) => message?.requestId === 'dangerous'
		);
		expect(dangerous.error).toBeDefined();

		channel.port2.postMessage({
			...envelope(session, 'future-message-kind'),
			requestId: 'unknown-kind',
		});
		const unknownKind = await inbox.take(
			(message) => message?.requestId === 'unknown-kind'
		);
		expect(unknownKind.error).toBeDefined();

		channel.port2.postMessage({
			...envelope(session, 'request'),
			requestId: 'unknown-codec',
			operation: 'call',
			path: ['increment'],
			args: [
				{
					representation: 'codec',
					codec: 'hostile.unknown-codec.v999',
					value: null,
				},
			],
		});
		const unknownCodec = await inbox.take(
			(message) => message?.requestId === 'unknown-codec'
		);
		expect(unknownCodec.error).toBeDefined();

		const request = {
			...envelope(session, 'request'),
			requestId: 'valid-call',
			operation: 'call',
			path: ['increment'],
			args: [cloneValue(4)],
		};
		channel.port2.postMessage(request);
		channel.port2.postMessage(request);
		const response = await inbox.take(
			(message) => message?.requestId === 'valid-call'
		);
		expect(response.value).toEqual(cloneValue(5));
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(calls).toBe(1);
		channel.port2.close();
	});

	it('does not let forged, malformed, duplicate, or unexpected responses settle calls', async () => {
		const channel = new MessageChannel();
		const inbox = createPortInbox(channel.port2);
		const remote = consumeAPI<{ value(): Promise<string> }>(channel.port1);
		const hello = await inbox.take((message) => message?.kind === 'hello');
		channel.port2.postMessage(envelope(hello.session, 'hello-ack'));
		await remote.isConnected();

		let settled = false;
		const value = remote.value().finally(() => {
			settled = true;
		});
		const request = await inbox.take(
			(message) => message?.kind === 'request'
		);
		channel.port2.postMessage({
			...envelope('forged-session-0002', 'response'),
			requestId: request.requestId,
			value: cloneValue('forged'),
		});
		channel.port2.postMessage({
			...envelope(hello.session, 'response'),
			requestId: 'unexpected-request-id',
			value: cloneValue('unexpected'),
		});
		channel.port2.postMessage({ unrelated: true });
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(settled).toBe(false);

		const validResponse = {
			...envelope(hello.session, 'response'),
			requestId: request.requestId,
			value: cloneValue('valid'),
		};
		channel.port2.postMessage(validResponse);
		channel.port2.postMessage(validResponse);
		expect(await value).toBe('valid');

		const invalidCodecCall = remote.value();
		const invalidCodecRequest = await inbox.take(
			(message) =>
				message?.kind === 'request' &&
				message.requestId !== request.requestId
		);
		channel.port2.postMessage({
			...envelope(hello.session, 'response'),
			requestId: invalidCodecRequest.requestId,
			value: {
				representation: 'codec',
				codec: 'unknown.response-codec.v1',
				value: null,
			},
		});
		await expect(invalidCodecCall).rejects.toBeInstanceOf(
			RPCSerializationError
		);

		const ambiguousCall = remote.value();
		const ambiguousRequest = await inbox.take(
			(message) => message?.kind === 'request'
		);
		channel.port2.postMessage({
			...envelope(hello.session, 'response'),
			requestId: ambiguousRequest.requestId,
			value: cloneValue('ambiguous'),
			error: { kind: 'value', value: cloneValue('also-an-error') },
		});
		await expect(ambiguousCall).rejects.toBeInstanceOf(
			RPCSerializationError
		);

		const recoveryCall = remote.value();
		const recoveryRequest = await inbox.take(
			(message) => message?.kind === 'request'
		);
		channel.port2.postMessage({
			...envelope(hello.session, 'response'),
			requestId: recoveryRequest.requestId,
			value: cloneValue('recovered'),
		});
		expect(await recoveryCall).toBe('recovered');
		await remote[releaseApiProxy]();
	});

	it('does not accept an operational response before handshake completion', async () => {
		const channel = new MessageChannel();
		const inbox = createPortInbox(channel.port2);
		const remote = consumeAPI<{ value(): Promise<string> }>(channel.port1);
		const pending = remote.value();
		let settled = false;
		void pending.finally(() => {
			settled = true;
		});
		const hello = await inbox.take((message) => message?.kind === 'hello');
		channel.port2.postMessage({
			...envelope(hello.session, 'response'),
			requestId: 'c-1',
			value: cloneValue('too-early'),
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(settled).toBe(false);

		channel.port2.postMessage(envelope(hello.session, 'hello-ack'));
		const request = await inbox.take(
			(message) => message?.kind === 'request'
		);
		channel.port2.postMessage({
			...envelope(hello.session, 'response'),
			requestId: request.requestId,
			value: cloneValue('after-handshake'),
		});
		expect(await pending).toBe('after-handshake');
		await remote[releaseApiProxy]();
	});

	it('converts result serialization failures into one remote error', async () => {
		const channel = new MessageChannel();
		exposeAPI(
			{
				uncloneable() {
					return new WeakMap();
				},
			},
			undefined,
			channel.port1
		);
		const remote = consumeAPI<{ uncloneable(): Promise<unknown> }>(
			channel.port2
		);

		await expect(remote.uncloneable()).rejects.toBeInstanceOf(
			RPCSerializationError
		);
		await remote[releaseApiProxy]();
	});

	it('supports child-process IPC and rejects transfer lists before send()', async () => {
		const [clientProcess, serverProcess] = createProcessPair();
		exposeAPI(
			{
				ping: () => 'pong',
				never: () => new Promise<void>(() => {}),
				takePort: () => 'received',
			},
			undefined,
			serverProcess
		);
		const remote = consumeAPI<{
			ping(): Promise<string>;
			never(): Promise<void>;
			takePort(port: MessagePort): Promise<string>;
		}>(clientProcess);

		expect(await remote.ping()).toBe('pong');
		const sendsBeforeTransfer = clientProcess.sendCount;
		const channel = new MessageChannel();
		await expect(remote.takePort(channel.port1)).rejects.toBeInstanceOf(
			RPCUnsupportedTransferError
		);
		expect(clientProcess.sendCount).toBe(sendsBeforeTransfer);
		channel.port1.close();
		channel.port2.close();

		const pending = remote.never();
		clientProcess.emit('disconnect');
		await expect(pending).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		expect(clientProcess.listenerCount('message')).toBe(0);
		expect(clientProcess.listenerCount('disconnect')).toBe(0);
	});

	it('detaches endpoint listeners when explicitly released', async () => {
		const [clientProcess, serverProcess] = createProcessPair();
		exposeAPI({ ping: () => 'pong' }, undefined, serverProcess);
		const remote = consumeAPI<{ ping(): Promise<string> }>(clientProcess);
		expect(await remote.ping()).toBe('pong');

		await remote[releaseApiProxy]();
		await Promise.resolve();
		expect(clientProcess.listenerCount('message')).toBe(0);
		expect(clientProcess.listenerCount('disconnect')).toBe(0);
		expect(serverProcess.listenerCount('message')).toBe(0);
		expect(serverProcess.listenerCount('disconnect')).toBe(0);
	});

	it('atomically terminates a session after a known post failure', async () => {
		const [clientProcess, serverProcess] = createProcessPair();
		exposeAPI(
			{
				ping: () => 'pong',
				never: () => new Promise<void>(() => {}),
			},
			undefined,
			serverProcess
		);
		const remote = consumeAPI<{
			ping(): Promise<string>;
			never(): Promise<void>;
		}>(clientProcess);
		expect(await remote.ping()).toBe('pong');
		const pending = remote.never();
		await Promise.resolve();
		clientProcess.connected = false;
		const failedPost = remote.ping();

		await expect(failedPost).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await expect(pending).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		const sendsAfterTermination = clientProcess.sendCount;
		await expect(remote.ping()).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		expect(clientProcess.sendCount).toBe(sendsAfterTermination);
		serverProcess.emit('disconnect');
	});
});

function envelope(session: string, kind: string) {
	return {
		protocol: RPC_PROTOCOL_MARKER,
		version: RPC_PROTOCOL_VERSION,
		session,
		kind,
	};
}

function cloneValue(value: unknown) {
	return { representation: 'clone', value };
}

function createPortInbox(port: MessagePort) {
	const messages: any[] = [];
	const waiters: Array<{
		predicate: (message: any) => boolean;
		resolve: (message: any) => void;
	}> = [];
	port.addEventListener('message', (event) => {
		const waiterIndex = waiters.findIndex(({ predicate }) =>
			predicate(event.data)
		);
		if (waiterIndex !== -1) {
			const [waiter] = waiters.splice(waiterIndex, 1);
			waiter.resolve(event.data);
			return;
		}
		messages.push(event.data);
	});
	port.start();
	return {
		take(predicate: (message: any) => boolean): Promise<any> {
			const index = messages.findIndex(predicate);
			if (index !== -1) {
				return Promise.resolve(messages.splice(index, 1)[0]);
			}
			return new Promise((resolve) =>
				waiters.push({ predicate, resolve })
			);
		},
	};
}

class FakeNodeProcess extends EventEmitter implements NodeProcess {
	peer: FakeNodeProcess | undefined;
	connected = true;
	sendCount = 0;

	send(message: unknown): boolean {
		this.sendCount++;
		if (!this.connected || !this.peer) {
			throw new Error('IPC disconnected');
		}
		const cloned = structuredClone(message);
		queueMicrotask(() => this.peer?.emit('message', cloned));
		return true;
	}
}

function createProcessPair(): [FakeNodeProcess, FakeNodeProcess] {
	const first = new FakeNodeProcess();
	const second = new FakeNodeProcess();
	first.peer = second;
	second.peer = first;
	return [first, second];
}
