/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {
	RemoteAPIEndpointTerminatedError,
	consumeAPI,
	exposeAPI,
	releaseApiProxy,
} from '@php-wasm/universal';
import { spawnPHPWorkerThread } from '../../lib/worker-thread/spawn-php-worker-thread';
import workerUrl from './rpc-browser-worker.ts?worker&url';

interface WorkerAPI {
	ping(value: string): Promise<string>;
	never(): Promise<never>;
	crash(): Promise<never>;
	closeSelf(): Promise<never>;
	finiteStream(): Promise<ReadableStream<Uint8Array>>;
	openStream(): Promise<ReadableStream<Uint8Array>>;
}

interface FrameAPI {
	isConnected(): Promise<void>;
	isReady(): Promise<void>;
	ping(value: string): Promise<string>;
	never(): Promise<never>;
}

async function testWorkerCallsAndStreams() {
	const nativeController = new AbortController();
	const nativeWorker = await spawnPHPWorkerThread(
		workerURLWithStreamTransport('native'),
		{
			signal: nativeController.signal,
		}
	);
	const nativeAPI = consumeAPI<WorkerAPI>(nativeWorker, {
		signal: nativeController.signal,
		streamTransport: 'native',
	});
	const ping = await nativeAPI.ping('browser');
	const nativeStreamValue = await readStream(await nativeAPI.finiteStream());
	await nativeAPI[releaseApiProxy]();
	nativeController.abort();

	const bridgeController = new AbortController();
	const bridgeWorker = await spawnPHPWorkerThread(
		workerURLWithStreamTransport('message-port'),
		{
			signal: bridgeController.signal,
		}
	);
	const bridgeAPI = consumeAPI<WorkerAPI>(bridgeWorker, {
		signal: bridgeController.signal,
		streamTransport: 'message-port',
	});
	const bridgeStreamValue = await readStream(await bridgeAPI.finiteStream());
	await bridgeAPI[releaseApiProxy]();
	bridgeController.abort();

	return { ping, nativeStreamValue, bridgeStreamValue };
}

async function testBrowserMessagePort() {
	const channel = new MessageChannel();
	const [setReady] = exposeAPI(
		{
			multiply(left: number, right: number) {
				return left * right;
			},
		},
		undefined,
		channel.port1
	);
	setReady();
	const api = consumeAPI<{
		multiply(left: number, right: number): Promise<number>;
	}>(channel.port2);
	const product = await api.multiply(6, 7);
	await api[releaseApiProxy]();
	return product;
}

async function testWindowOriginPolicy() {
	const invalidOrigins = ['*', 'null', `${location.origin}/path`];
	const errors = invalidOrigins.map((targetOrigin) => {
		try {
			consumeAPI(window, { targetOrigin });
			return 'accepted';
		} catch (error) {
			return error instanceof Error ? error.name : typeof error;
		}
	});
	try {
		exposeAPI({}, undefined, window);
		errors.push('accepted');
	} catch (error) {
		errors.push(error instanceof Error ? error.name : typeof error);
	}
	try {
		exposeAPI({});
		errors.push('accepted');
	} catch (error) {
		errors.push(error instanceof Error ? error.name : typeof error);
	}

	const sandboxedFrame = document.createElement('iframe');
	sandboxedFrame.setAttribute('sandbox', '');
	sandboxedFrame.srcdoc = '<!doctype html><title>opaque frame</title>';
	const loaded = new Promise<void>((resolve) => {
		sandboxedFrame.addEventListener('load', () => resolve(), {
			once: true,
		});
	});
	document.body.append(sandboxedFrame);
	await loaded;
	try {
		exposeAPI(
			{},
			undefined,
			sandboxedFrame.contentWindow as unknown as object
		);
		errors.push('accepted');
	} catch (error) {
		errors.push(error instanceof Error ? error.name : typeof error);
	}
	sandboxedFrame.remove();
	return errors;
}

async function testHostileWindowBootstrap() {
	const target = await loadFrame();
	target.id = `rpc-bootstrap-target-${Math.random().toString(36).slice(2)}`;
	const wrongSourceAcknowledged = await attackFromSibling(target);
	const wrongMarkerAcknowledged = await rawBootstrapAcknowledged(target, {
		marker: 'unrelated-protocol',
	});
	target.contentWindow!.postMessage(
		bootstrapEnvelope('zero-port-session'),
		location.origin
	);
	const multiplePortsAcknowledged = await rawBootstrapAcknowledged(target, {
		portCount: 2,
	});

	const controller = new AbortController();
	const api = consumeAPI<FrameAPI>(target.contentWindow!, {
		context: window,
		signal: controller.signal,
		targetOrigin: location.origin,
		handshakeRetryMs: 5,
	});
	await api.isConnected();
	const pingAfterHostileTraffic = await api.ping('still-private');
	await api[releaseApiProxy]();
	controller.abort();
	target.remove();

	const wrongOriginTarget = await loadFrame('https://example.invalid');
	const wrongOriginAcknowledged =
		await rawBootstrapAcknowledged(wrongOriginTarget);
	wrongOriginTarget.remove();

	return {
		wrongSourceAcknowledged,
		wrongMarkerAcknowledged,
		multiplePortsAcknowledged,
		wrongOriginAcknowledged,
		pingAfterHostileTraffic,
	};
}

async function testMalformedBootstrapResponseRecovery() {
	const iframe = document.createElement('iframe');
	iframe.src = new URL(
		'./rpc-browser-malformed-frame.html',
		import.meta.url
	).href;
	const loaded = new Promise<void>((resolve) => {
		iframe.addEventListener('load', () => resolve(), { once: true });
	});
	document.body.append(iframe);
	await loaded;

	const controller = new AbortController();
	const api = consumeAPI<FrameAPI>(iframe.contentWindow!, {
		context: window,
		signal: controller.signal,
		targetOrigin: location.origin,
		handshakeRetryMs: 10,
	});
	await api.isConnected();
	const result = await api.ping('private-port');
	await api[releaseApiProxy]();
	controller.abort();
	iframe.remove();
	return result;
}

async function testWorkerFailureAndOwnerTermination() {
	const crashing = await spawnPHPWorkerThread(workerUrl);
	const crashingAPI = consumeAPI<WorkerAPI>(crashing);
	const crashError = await rejectionDetails(crashingAPI.crash());
	crashing.terminate();

	const controller = new AbortController();
	const worker = await spawnPHPWorkerThread(workerUrl, {
		signal: controller.signal,
	});
	const api = consumeAPI<WorkerAPI>(worker, { signal: controller.signal });
	const pending = api.never();
	worker.terminate();
	controller.abort(new Error('The worker owner terminated it.'));
	const terminationError = await rejectionDetails(pending);
	const repeatedRelease = await Promise.all([
		api[releaseApiProxy](),
		api[releaseApiProxy](),
	]).then(() => 'resolved');

	return { crashError, terminationError, repeatedRelease };
}

async function testWorkerSelfTerminationAndStreamCleanup() {
	const selfController = new AbortController();
	const selfWorker = await spawnPHPWorkerThread(workerUrl, {
		signal: selfController.signal,
	});
	const selfAPI = consumeAPI<WorkerAPI>(selfWorker, {
		signal: selfController.signal,
	});
	const selfClosing = selfAPI.closeSelf();
	await new Promise((resolve) => setTimeout(resolve, 20));
	selfController.abort(
		new Error('The owner observed that the worker stopped itself.')
	);
	const selfTerminationError = await rejectionDetails(selfClosing);

	const streamController = new AbortController();
	const streamWorker = await spawnPHPWorkerThread(workerUrl, {
		signal: streamController.signal,
	});
	const streamAPI = consumeAPI<WorkerAPI>(streamWorker, {
		signal: streamController.signal,
		streamTransport: 'message-port',
	});
	const reader = (await streamAPI.openStream()).getReader();
	const first = new TextDecoder().decode((await reader.read()).value);
	const pendingRead = reader.read();
	streamController.abort(
		new Error('The stream owner terminated the worker.')
	);
	const streamError = await rejectionDetails(pendingRead);

	return { selfTerminationError, first, streamError };
}

async function testWindowPrivatePortAndLifecycle() {
	let normalWindowTraffic = 0;
	const onMessage = (event: MessageEvent) => {
		if (event.data?.protocol === 'wordpress-playground-rpc') {
			normalWindowTraffic++;
		}
	};
	window.addEventListener('message', onMessage);

	const removal = await createFrameAPI();
	removal.iframe.contentWindow?.postMessage(
		{ unrelated: true },
		location.origin
	);
	const ping = await removal.api.ping('private-port');
	const removalPending = removal.api.never();
	removal.iframe.remove();
	removal.controller.abort(new Error('The iframe owner removed it.'));
	const removalError = await rejectionDetails(removalPending);

	const navigation = await createFrameAPI();
	const navigationPending = navigation.api.never();
	const navigated = new Promise<void>((resolve) => {
		navigation.iframe.addEventListener('load', () => resolve(), {
			once: true,
		});
	});
	navigation.iframe.src = 'about:blank';
	await navigated;
	navigation.controller.abort(new Error('The iframe owner navigated it.'));
	const navigationError = await rejectionDetails(navigationPending);
	navigation.iframe.remove();

	window.removeEventListener('message', onMessage);
	return { ping, normalWindowTraffic, removalError, navigationError };
}

async function createFrameAPI() {
	const iframe = await loadFrame();
	const controller = new AbortController();
	const api = consumeAPI<FrameAPI>(iframe.contentWindow!, {
		context: window,
		signal: controller.signal,
		targetOrigin: location.origin,
		handshakeRetryMs: 5,
	});
	await api.isConnected();
	await api.isReady();
	return { api, controller, iframe };
}

async function loadFrame(allowedOrigin?: string) {
	const iframe = document.createElement('iframe');
	const url = new URL('./rpc-browser-frame.html', import.meta.url);
	if (allowedOrigin) url.searchParams.set('allowed-origin', allowedOrigin);
	iframe.src = url.href;
	const loaded = new Promise<void>((resolve) => {
		iframe.addEventListener('load', () => resolve(), { once: true });
	});
	document.body.append(iframe);
	await loaded;
	return iframe;
}

async function attackFromSibling(target: HTMLIFrameElement) {
	const attacker = document.createElement('iframe');
	const result = new Promise<boolean>((resolve) => {
		const onMessage = (event: MessageEvent) => {
			if (
				event.source === attacker.contentWindow &&
				event.origin === location.origin &&
				event.data?.protocol === 'rpc-hostile-source-result'
			) {
				window.removeEventListener('message', onMessage);
				resolve(Boolean(event.data.acknowledged));
			}
		};
		window.addEventListener('message', onMessage);
	});
	const url = new URL('./rpc-browser-attacker.html', import.meta.url);
	url.searchParams.set('target-id', target.id);
	attacker.src = url.href;
	document.body.append(attacker);
	const acknowledged = await result;
	attacker.remove();
	return acknowledged;
}

function rawBootstrapAcknowledged(
	target: HTMLIFrameElement,
	options: { marker?: string; portCount?: number } = {}
) {
	return new Promise<boolean>((resolve) => {
		const channels = Array.from(
			{ length: options.portCount || 1 },
			() => new MessageChannel()
		);
		let settled = false;
		const finish = (acknowledged: boolean) => {
			if (settled) return;
			settled = true;
			for (const channel of channels) channel.port1.close();
			resolve(acknowledged);
		};
		for (const channel of channels) {
			channel.port1.addEventListener('message', () => finish(true), {
				once: true,
			});
			channel.port1.start();
		}
		target.contentWindow!.postMessage(
			{
				...bootstrapEnvelope('hostile-bootstrap-session'),
				protocol:
					options.marker || 'wordpress-playground-rpc-bootstrap',
			},
			location.origin,
			channels.map((channel) => channel.port2)
		);
		setTimeout(() => finish(false), 60);
	});
}

function bootstrapEnvelope(session: string) {
	return {
		protocol: 'wordpress-playground-rpc-bootstrap',
		version: 1,
		kind: 'connect',
		session,
	};
}

async function readStream(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	return new TextDecoder().decode(
		chunks.length === 1 ? chunks[0] : concatenate(chunks)
	);
}

function workerURLWithStreamTransport(transport: 'native' | 'message-port') {
	const url = new URL(workerUrl, location.href);
	url.searchParams.set('rpc-stream-transport', transport);
	return url.href;
}

function concatenate(chunks: readonly Uint8Array[]) {
	const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
	const combined = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return combined;
}

async function rejectionDetails(promise: Promise<unknown>) {
	try {
		await promise;
		return {
			name: 'Resolved',
			endpointTerminated: false,
			endpointType: undefined,
		};
	} catch (error) {
		return {
			name: error instanceof Error ? error.name : typeof error,
			endpointTerminated:
				error instanceof RemoteAPIEndpointTerminatedError,
			endpointType:
				error instanceof RemoteAPIEndpointTerminatedError
					? error.endpointType
					: undefined,
		};
	}
}

window.rpcAcceptanceHarness = {
	testWorkerCallsAndStreams,
	testBrowserMessagePort,
	testWindowOriginPolicy,
	testHostileWindowBootstrap,
	testMalformedBootstrapResponseRecovery,
	testWorkerFailureAndOwnerTermination,
	testWorkerSelfTerminationAndStreamCleanup,
	testWindowPrivatePortAndLifecycle,
};

declare global {
	interface Window {
		rpcAcceptanceHarness: {
			testWorkerCallsAndStreams: typeof testWorkerCallsAndStreams;
			testBrowserMessagePort: typeof testBrowserMessagePort;
			testWindowOriginPolicy: typeof testWindowOriginPolicy;
			testHostileWindowBootstrap: typeof testHostileWindowBootstrap;
			testMalformedBootstrapResponseRecovery: typeof testMalformedBootstrapResponseRecovery;
			testWorkerFailureAndOwnerTermination: typeof testWorkerFailureAndOwnerTermination;
			testWorkerSelfTerminationAndStreamCleanup: typeof testWorkerSelfTerminationAndStreamCleanup;
			testWindowPrivatePortAndLifecycle: typeof testWindowPrivatePortAndLifecycle;
		};
	}
}
