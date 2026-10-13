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
};
const connections = new Map<string, Connection>();
const clientRuntimes = new Map<string, Map<string, string>>();
const pending = new Map<string, Promise<boolean>>();
const registrationWaiters = new Map<string, () => void>();

export function registerSharedRuntime(event: ExtendableMessageEvent) {
	if (event.data?.type !== 'register-shared-runtime') return;
	const scope = event.data.scope;
	const port = event.ports[0];
	const previous = connections.get(scope);
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
				void rememberRetiredClients(
					scope,
					connection.runtimeId ?? connection.buildVersion
				);
			} else if (data?.type === RUNTIME_CLOSED) connection.closed = true;
		});
		port.start();
	}
}

/** Restores a direct route after ServiceWorker eviction, contacting one remote document. */
export async function hasSharedRuntime(scope: string): Promise<boolean> {
	if (
		new URL(self.location.href).searchParams.get(
			'experimental-shared-worker'
		) !== '1'
	)
		return false;
	if (connections.has(scope)) return true;
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
	const remote = clients.find((client) => {
		const url = new URL(client.url);
		return (
			url.searchParams.get('experimental-shared-worker') === '1' &&
			url.searchParams.get('scope') === scope
		);
	});
	if (!remote) return false;
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
	// A shared document must never fall back to broadcasting PHP requests.
	if (!connections.has(scope))
		connections.set(scope, { retired: true, pendingRequests: 0 });
	return true;
}

export async function sendSharedRuntimeRequest(
	message: { method: string; args: any[] },
	scope: string,
	requestClient?: Pick<FetchEvent, 'clientId' | 'resultingClientId'>
) {
	const connection = connections.get(scope);
	if (!connection?.port || connection.retired)
		return reloadResponse(!!connection?.closed);
	const generation = connection.runtimeId ?? connection.buildVersion;
	if (requestClient && generation) {
		const versions = clientRuntimes.get(scope) ?? new Map<string, string>();
		clientRuntimes.set(scope, versions);
		const previous = versions.get(requestClient.clientId);
		if (previous && previous !== generation) return reloadResponse(true);
		if (requestClient.clientId)
			versions.set(requestClient.clientId, generation);
		if (requestClient.resultingClientId)
			versions.set(requestClient.resultingClientId, generation);
	}
	connection.pendingRequests++;
	try {
		const requestId = getNextRequestId();
		const reply = awaitReply(connection.port, requestId);
		connection.port.postMessage({ ...message, requestId });
		const result = await reply;
		if (result?.error === RELOAD_REQUIRED)
			return reloadResponse(!!connection.closed);
		if (result?.error) throw new Error(result.error);
		return result;
	} finally {
		connection.pendingRequests--;
		if (connection.superseded && !connection.pendingRequests)
			connection.port.close();
	}
}

async function rememberRetiredClients(scope: string, version?: string) {
	if (!version) return;
	const versions = clientRuntimes.get(scope) ?? new Map<string, string>();
	clientRuntimes.set(scope, versions);
	for (const client of await self.clients.matchAll({
		includeUncontrolled: true,
		type: 'window',
	})) {
		if (!versions.has(client.id)) versions.set(client.id, version);
	}
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
