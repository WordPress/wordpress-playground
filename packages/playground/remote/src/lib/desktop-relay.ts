import { removeURLScope } from '@php-wasm/scopes';

export type DesktopRelayMapping = {
	scope: string;
	sessionId: string;
	clientId?: string;
	interceptedRequests: number;
	lastInterceptedPath?: string;
	expiresAt: number;
};

const desktopRelayMappings: Record<string, DesktopRelayMapping> = {};

export function handleDesktopRelayMessage(
	event: ExtendableMessageEvent
): boolean {
	const data = event.data;
	if (typeof data !== 'object' || data === null || !('type' in data)) {
		return false;
	}

	if (data.type === 'desktop-relay-map') {
		const { scope, sessionId, ttl } = data as Record<string, unknown>;
		if (typeof scope !== 'string' || typeof sessionId !== 'string') {
			return true;
		}
		const existing = desktopRelayMappings[scope];
		desktopRelayMappings[scope] = {
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
			type: 'desktop-relay-map-result',
			ok: true,
			clientId: desktopRelayMappings[scope].clientId,
		});
		return true;
	}

	if (data.type === 'desktop-relay-clear') {
		const { scope } = data as Record<string, unknown>;
		if (typeof scope === 'string') {
			delete desktopRelayMappings[scope];
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

export function getDesktopRelayMapping(
	scope: string
): DesktopRelayMapping | undefined {
	const mapping = desktopRelayMappings[scope];
	if (!mapping) {
		return;
	}
	if (mapping.expiresAt <= Date.now()) {
		delete desktopRelayMappings[scope];
		return;
	}
	return mapping;
}

export function handleDesktopRelayProbe(scope: string): Response {
	const mapping = getDesktopRelayMapping(scope);
	return new Response(
		JSON.stringify({
			ok: true,
			scope,
			hasMapping: !!mapping,
			clientId: mapping?.clientId,
			interceptedRequests: mapping?.interceptedRequests ?? 0,
			lastInterceptedPath: mapping?.lastInterceptedPath ?? null,
		}),
		{
			headers: {
				'Content-Type': 'application/json',
				'X-Desktop-Relay-Service-Worker': '1',
			},
		}
	);
}

export async function handleDesktopRelayRequest(
	event: FetchEvent,
	mapping: DesktopRelayMapping
) {
	const requestId = crypto.randomUUID();
	const unscopedUrl = removeURLScope(new URL(event.request.url));
	const path = `${unscopedUrl.pathname}${unscopedUrl.search}`;
	mapping.interceptedRequests += 1;
	mapping.lastInterceptedPath = `${event.request.method} ${path}`;
	const body = await requestBodyToBytes(event.request);
	const response = await postRequestToDesktopClient(mapping, {
		type: 'desktop-relay-request',
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

async function requestBodyToBytes(
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

function collectHeaders(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	headers.forEach((value, key) => {
		result[key] = value;
	});
	return result;
}

async function postRequestToDesktopClient(
	mapping: DesktopRelayMapping,
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
			return (
				new URL(candidate.url).searchParams.get('share') ===
				mapping.sessionId
			);
		} catch {
			return false;
		}
	});
	if (!fallbackClient) {
		throw new Error('Desktop relay page is not available');
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
			reject(new Error('Desktop relay request timed out'));
		}, 30000);
		channel.port1.onmessage = (event) => {
			clearTimeout(timeout);
			const data = event.data;
			if (data?.type === 'desktop-relay-response') {
				resolve(data.response);
				return;
			}
			reject(new Error(data?.error || 'Desktop relay request failed'));
		};
	});
	client.postMessage(message, [channel.port2]);
	return result;
}
