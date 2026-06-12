/// <reference lib="WebWorker" />

import { removeURLScope } from '@php-wasm/scopes';

export type RemoteAccessRelayMapping = {
	scope: string;
	sessionId: string;
	clientId?: string;
	interceptedRequests: number;
	lastInterceptedPath?: string;
	expiresAt: number;
};

const remoteAccessRelayMappings: Record<string, RemoteAccessRelayMapping> = {};

export function handleRemoteAccessRelayMessage(
	event: ExtendableMessageEvent
): boolean {
	const data = event.data;
	if (typeof data !== 'object' || data === null || !('type' in data)) {
		return false;
	}

	if (data.type === 'remote-access-relay-map') {
		const { scope, sessionId, ttl } = data as Record<string, unknown>;
		if (typeof scope !== 'string' || typeof sessionId !== 'string') {
			return true;
		}
		const existing = remoteAccessRelayMappings[scope];
		remoteAccessRelayMappings[scope] = {
			scope,
			sessionId,
			clientId: getSourceClientId(event),
			interceptedRequests: existing?.interceptedRequests ?? 0,
			lastInterceptedPath: existing?.lastInterceptedPath,
			expiresAt:
				Date.now() +
				(typeof ttl === 'number' && Number.isFinite(ttl)
					? ttl
					: 5 * 60 * 1000),
		};
		event.ports[0]?.postMessage({
			type: 'remote-access-relay-map-result',
			ok: true,
			clientId: remoteAccessRelayMappings[scope].clientId,
		});
		return true;
	}

	if (data.type === 'remote-access-relay-clear') {
		const { scope } = data as Record<string, unknown>;
		if (typeof scope === 'string') {
			delete remoteAccessRelayMappings[scope];
		}
		return true;
	}

	return false;
}

function getSourceClientId(event: ExtendableMessageEvent): string | undefined {
	const source = event.source;
	if (source && 'id' in source && typeof source.id === 'string') {
		return source.id;
	}
	return undefined;
}

export function getRemoteAccessRelayMapping(
	scope: string
): RemoteAccessRelayMapping | undefined {
	const mapping = remoteAccessRelayMappings[scope];
	if (!mapping) {
		return;
	}
	if (mapping.expiresAt <= Date.now()) {
		delete remoteAccessRelayMappings[scope];
		return;
	}
	return mapping;
}

export function getRemoteAccessRelayMappingFromUrl(
	scope: string,
	url: URL
): RemoteAccessRelayMapping | undefined {
	const sessionId = url.searchParams.get('remote-access-view');
	if (!sessionId) {
		return;
	}
	const existing = remoteAccessRelayMappings[scope];
	remoteAccessRelayMappings[scope] = {
		scope,
		sessionId,
		clientId: existing?.clientId,
		interceptedRequests: existing?.interceptedRequests ?? 0,
		lastInterceptedPath: existing?.lastInterceptedPath,
		expiresAt: Date.now() + 5 * 60 * 1000,
	};
	return remoteAccessRelayMappings[scope];
}

export function handleRemoteAccessRelayProbe(
	scope: string,
	sessionId: string | null
): Response {
	const mapping = getRemoteAccessRelayMapping(scope);
	if (!mapping || mapping.sessionId !== sessionId) {
		return new Response('Not found', { status: 404 });
	}

	return new Response(
		JSON.stringify({
			ok: true,
			scope,
			hasMapping: true,
			clientId: mapping.clientId,
			interceptedRequests: mapping.interceptedRequests,
			lastInterceptedPath: mapping.lastInterceptedPath ?? null,
		}),
		{
			headers: {
				'Content-Type': 'application/json',
				'X-Remote-Access-Service-Worker': '1',
			},
		}
	);
}

export async function handleRemoteAccessRelayRequest(
	event: FetchEvent,
	mapping: RemoteAccessRelayMapping
) {
	const requestId = crypto.randomUUID();
	const unscopedUrl = removeURLScope(new URL(event.request.url));
	const path = `${unscopedUrl.pathname}${unscopedUrl.search}`;
	mapping.interceptedRequests += 1;
	mapping.lastInterceptedPath = `${event.request.method} ${path}`;
	const body = await requestBodyToBytes(event.request);
	const response = await postRequestToRemoteAccessClient(mapping, {
		type: 'remote-access-relay-request',
		sessionId: mapping.sessionId,
		requestId,
		method: event.request.method,
		path,
		headers: collectHeaders(event.request.headers),
		body,
	});
	return new Response(response.body || new Uint8Array(), {
		status: response.status,
		headers: new Headers(response.headers),
	});
}

export async function requestBodyToBytes(
	request: Request
): Promise<Uint8Array | undefined> {
	if (request.method === 'GET' || request.method === 'HEAD') {
		return undefined;
	}
	const buffer = await request.clone().arrayBuffer();
	if (buffer.byteLength === 0) {
		return undefined;
	}
	return new Uint8Array(buffer);
}

export function collectHeaders(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	headers.forEach((value, key) => {
		result[key] = value;
	});
	return result;
}

async function postRequestToRemoteAccessClient(
	mapping: RemoteAccessRelayMapping,
	message: Record<string, unknown>
): Promise<{
	status: number;
	headers: Record<string, string>;
	body: Uint8Array;
}> {
	const serviceWorker = self as unknown as ServiceWorkerGlobalScope;
	const client = mapping.clientId
		? await serviceWorker.clients.get(mapping.clientId)
		: undefined;
	if (client) {
		return postRequestToClient(client, message);
	}

	const clients = await serviceWorker.clients.matchAll({
		type: 'window',
		includeUncontrolled: true,
	});
	const fallbackClient = clients.find((candidate: Client) => {
		try {
			const url = new URL(candidate.url);
			return (
				url.searchParams.get('share') === mapping.sessionId ||
				(url.pathname.startsWith('/connect') &&
					!url.pathname.startsWith('/scope:'))
			);
		} catch {
			return false;
		}
	});
	if (!fallbackClient) {
		throw new Error('Remote access page is not available');
	}
	return postRequestToClient(fallbackClient, message);
}

function postRequestToClient(
	client: Client,
	message: Record<string, unknown>
): Promise<{
	status: number;
	headers: Record<string, string>;
	body: Uint8Array;
}> {
	const channel = new MessageChannel();
	const result = new Promise<{
		status: number;
		headers: Record<string, string>;
		body: Uint8Array;
	}>((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Remote access relay request timed out'));
		}, 30000);
		channel.port1.onmessage = (event) => {
			clearTimeout(timeout);
			const data = event.data;
			if (data?.type === 'remote-access-relay-response') {
				resolve(data.response);
				return;
			}
			reject(
				new Error(data?.error || 'Remote access relay request failed')
			);
		};
	});
	client.postMessage(message, [channel.port2]);
	return result;
}
