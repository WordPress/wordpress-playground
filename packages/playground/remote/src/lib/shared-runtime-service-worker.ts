/// <reference lib="WebWorker" />
import { awaitReply, getNextRequestId } from '@php-wasm/web-service-worker';
import { RELOAD_REQUIRED, RUNTIME_CLOSED } from './shared-runtime';

declare const self: ServiceWorkerGlobalScope;
type Connection = {
	port?: MessagePort;
	retired: boolean;
	closed?: boolean;
	buildVersion?: string;
	runtimeId?: string;
	pendingRequests: number;
	superseded?: boolean;
	moduleDetails?: ReturnType<typeof sendConnectionRequest>;
};
const connections = new Map<string, Connection>();
const clientRuntimes = new Map<string, Map<string, string>>();
const pending = new Map<string, Promise<boolean>>();
const registrationWaiters = new Map<string, () => void>();
// Separate from release asset caches: live documents outlast ServiceWorker deployments.
const CLIENT_RUNTIME_CACHE = 'playground-client-runtimes';

export function registerSharedRuntime(event: ExtendableMessageEvent) {
	if (event.data?.type !== 'register-shared-runtime') return;
	const scope = event.data.scope;
	const port = event.ports[0];
	const previous = connections.get(scope);
	if (
		event.data.retired &&
		previous?.port &&
		!previous.retired &&
		previous.runtimeId !== event.data.runtimeId
	) {
		// A delayed retired tab must not replace a newer live connection.
		registrationWaiters.get(scope)?.();
		return;
	}
	if (previous) {
		previous.superseded = true;
		if (!previous.pendingRequests) previous.port?.close();
	}
	const connection = {
		port,
		retired: !!event.data.retired,
		closed: !!event.data.closed,
		buildVersion: event.data.buildVersion as string | undefined,
		runtimeId: event.data.runtimeId as string | undefined,
		pendingRequests: 0,
	};
	connections.set(scope, connection);

	registrationWaiters.get(scope)?.();
	if (port) {
		port.addEventListener('message', ({ data }) => {
			if (data?.type === 'shared-runtime-retired') {
				connection.retired = true;
			} else if (data?.type === RUNTIME_CLOSED) connection.closed = true;
		});
		port.start();
	}
}

/** Restores a direct route after ServiceWorker eviction, contacting one remote document. */
export async function hasSharedRuntime(scope: string): Promise<boolean> {
	if (new URL(self.location.href).searchParams.get('shared-worker') !== '1')
		return false;
	if (connections.has(scope) && !connections.get(scope)!.retired) return true;
	if (pending.has(scope)) return pending.get(scope)!;
	const promise = discoverSharedRuntime(scope);
	pending.set(scope, promise);
	try {
		return await promise;
	} finally {
		pending.delete(scope);
	}
}

async function discoverSharedRuntime(scope: string): Promise<boolean> {
	const clients = await self.clients.matchAll({
		includeUncontrolled: true,
		type: 'window',
	});
	const remotes = clients.filter((client) => {
		const url = new URL(client.url);
		return (
			url.searchParams.get('shared-worker') === '1' &&
			url.searchParams.get('scope') === scope
		);
	});
	if (!remotes.length) return connections.has(scope);
	for (const remote of remotes) {
		const registered = new Promise<void>((resolve) => {
			registrationWaiters.set(scope, resolve);
		});
		remote.postMessage({ type: 'connect-shared-runtime' });
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				registered,
				new Promise<void>((resolve) => {
					timeout = setTimeout(resolve, 5000);
				}),
			]);
		} finally {
			clearTimeout(timeout);
			registrationWaiters.delete(scope);
		}
		if (connections.get(scope)?.port && !connections.get(scope)!.retired)
			return true;
	}
	// A shared document must never fall back to broadcasting PHP requests.
	// Leave a timeout retryable, while still using the direct route for this request.
	return true;
}

export async function sendSharedRuntimeRequest(
	message: { method: string; args: any[] },
	scope: string,
	requestClient?: Pick<FetchEvent, 'clientId' | 'resultingClientId'>
) {
	const connection = connections.get(scope);
	if (connection?.retired) {
		return reloadResponse(!!connection.closed);
	}
	if (!connection?.port) {
		// Discovery can time out while a document is busy. Do not latch its reload UI.
		return {
			httpStatusCode: 503,
			headers: {
				'content-type': ['text/html; charset=utf-8'],
				'cache-control': ['no-store'],
			},
			bytes: new TextEncoder().encode(
				'WordPress is still connecting. Try again.'
			),
		};
	}
	const generation = connection.runtimeId ?? connection.buildVersion;
	if (requestClient && generation) {
		const previous = await readClientRuntime(scope, requestClient.clientId);

		if (previous && previous !== generation) return reloadResponse(true);
		if (requestClient.clientId)
			await rememberClientRuntime(
				scope,
				requestClient.clientId,
				generation
			);
		if (requestClient.resultingClientId)
			await rememberClientRuntime(
				scope,
				requestClient.resultingClientId,
				generation
			);
	}
	if (message.method === 'getWordPressModuleDetails') {
		connection.moduleDetails ??= sendConnectionRequest(
			connection,
			connection.port,
			message
		).catch((error) => {
			connection.moduleDetails = undefined;
			throw error;
		});
		return connection.moduleDetails;
	}
	return sendConnectionRequest(connection, connection.port, message);
}

async function sendConnectionRequest(
	connection: Connection,
	port: MessagePort,
	message: { method: string; args: any[] }
) {
	connection.pendingRequests++;
	try {
		const requestId = getNextRequestId();
		const reply = awaitReply(port, requestId);
		port.postMessage({ ...message, requestId });
		const result = await reply;
		if (result?.error === RELOAD_REQUIRED)
			return reloadResponse(!!connection.closed);
		if (result?.error) throw new Error(result.error);
		return result;
	} finally {
		connection.pendingRequests--;
		if (connection.superseded && !connection.pendingRequests) port.close();
	}
}

async function readClientRuntime(scope: string, clientId: string) {
	if (!clientId) return undefined;
	const remembered = clientRuntimes.get(scope)?.get(clientId);
	if (remembered) return remembered;
	try {
		const cache = await caches.open(CLIENT_RUNTIME_CACHE);
		const response = await cache.match(clientRuntimeKey(scope, clientId));
		return response ? await response.text() : undefined;
	} catch {
		// Persistent tracking is optional; storage failures must not block PHP requests.
		return undefined;
	}
}

async function rememberClientRuntime(
	scope: string,
	clientId: string,
	runtimeId: string
) {
	const versions = clientRuntimes.get(scope) ?? new Map<string, string>();
	clientRuntimes.set(scope, versions);
	if (versions.get(clientId) === runtimeId) return;
	versions.set(clientId, runtimeId);
	try {
		const cache = await caches.open(CLIENT_RUNTIME_CACHE);
		await cache.put(
			clientRuntimeKey(scope, clientId),
			new Response(runtimeId)
		);
	} catch {
		// Keep tracking in memory when persistence is unavailable.
	}
}

function clientRuntimeKey(scope: string, clientId: string) {
	const url = new URL('/playground-client-runtime', self.location.href);
	url.searchParams.set('scope', scope);
	url.searchParams.set('client', clientId);
	return url.href;
}

function reloadResponse(ready = false) {
	return {
		httpStatusCode: 503,
		headers: {
			'content-type': ['text/html; charset=utf-8'],
			'cache-control': ['no-store'],
			'x-playground-reload-required': ['1'],
			'x-playground-runtime-closed': [ready ? '1' : '0'],
		},
		bytes: new TextEncoder()
			.encode(`<!doctype html><p>A new version is available. Reload this tab to continue.</p>
<script>parent.postMessage({type:'${RELOAD_REQUIRED}',ready:${ready}}, location.origin)</script>`),
	};
}
