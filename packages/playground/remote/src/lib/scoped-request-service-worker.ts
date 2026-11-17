/// <reference lib="WebWorker" />
import { awaitReply, getNextRequestId } from '@php-wasm/web-service-worker';
import { playgroundOrigin, wordPressSiteUrl } from './config';
import {
	CONNECT_SCOPED_REQUEST_PORT,
	REGISTER_SCOPED_REQUEST_PORT,
} from './scoped-request-port';
import { isWordPressBridgePath } from './wordpress-bridge-path';

declare const self: ServiceWorkerGlobalScope;

type Connection = { port: MessagePort; clientId: string };
const connections = new Map<string, Connection>();
const discoveries = new Map<string, Promise<Connection | undefined>>();
const registrationWaiters = new Map<string, () => void>();
const DISCOVERY_TIMEOUT = 10000;

/**
 * Accept a scope's MessagePort from the document that serves its PHP requests.
 *
 * In split-origin mode, only the hidden WordPress-origin helper for that scope
 * qualifies; WordPress pages and other scopes' helpers share this worker but must
 * not receive or answer its requests. The latest registration replaces the
 * previous one, e.g. after a reload.
 */
export function registerScopedRequestPort(event: ExtendableMessageEvent) {
	if (event.data?.type !== REGISTER_SCOPED_REQUEST_PORT) return;
	const scope = event.data.scope;
	const port = event.ports[0];
	const client = event.source as Client | null;
	if (!port) return;
	if (
		typeof scope !== 'string' ||
		!client?.id ||
		!mayServeScope(client, scope)
	) {
		port.close();
		return;
	}
	port.start();
	connections.set(scope, { port, clientId: client.id });
	registrationWaiters.get(scope)?.();
}

/**
 * Send one PHP message to the document serving the scope and await its reply.
 *
 * Only that document's port carries the request and the reply. Connections end
 * when the worker restarts or the document closes; ask that scope's documents
 * to register again rather than broadcasting the request.
 */
export async function sendScopedRequest(
	message: { method: string; args?: any[] },
	scope: string
) {
	const connection = await getConnection(scope);
	if (!connection) {
		throw new Error(`No Playground is serving the scope "${scope}".`);
	}
	const requestId = getNextRequestId();
	const reply = awaitReply(connection.port, requestId);
	connection.port.postMessage({ ...message, requestId });
	return reply;
}

async function getConnection(scope: string) {
	const connection = connections.get(scope);
	if (connection && (await self.clients.get(connection.clientId))) {
		return connection;
	}
	if (connections.get(scope) === connection) connections.delete(scope);
	if (!discoveries.has(scope)) {
		discoveries.set(
			scope,
			discoverConnection(scope).finally(() => discoveries.delete(scope))
		);
	}
	return discoveries.get(scope);
}

async function discoverConnection(scope: string) {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const registered = new Promise<void>((resolve) => {
		registrationWaiters.set(scope, resolve);
		timeout = setTimeout(resolve, DISCOVERY_TIMEOUT);
	});
	try {
		const clients = await self.clients.matchAll({
			includeUncontrolled: true,
			type: 'window',
		});
		for (const client of clients) {
			// A helper knows its own scope; do not name it in the message.
			if (mayServeScope(client, scope)) {
				client.postMessage({ type: CONNECT_SCOPED_REQUEST_PORT });
			}
		}
		await registered;
		return connections.get(scope);
	} finally {
		clearTimeout(timeout);
		registrationWaiters.delete(scope);
	}
}

/**
 * Single-origin builds render WordPress on the app origin, where every page can
 * already reach PHP's storage, so any client may serve a scope there.
 */
function mayServeScope(client: Client, scope: string) {
	if (wordPressSiteUrl === playgroundOrigin) return true;
	const url = new URL(client.url);
	return (
		url.origin === self.location.origin &&
		isWordPressBridgePath(url.pathname) &&
		url.searchParams.get('scope') === scope
	);
}
