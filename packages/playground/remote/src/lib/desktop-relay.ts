import { removeURLScope } from '@php-wasm/scopes';

export type DesktopRelayMapping = {
	scope: string;
	sessionId: string;
	expiresAt: number;
};

const desktopRelayMappings: Record<string, DesktopRelayMapping> = {};

export function handleDesktopRelayMessage(data: unknown): boolean {
	if (typeof data !== 'object' || data === null || !('type' in data)) {
		return false;
	}

	if (data.type === 'desktop-relay-map') {
		const { scope, sessionId, ttl } = data as Record<string, unknown>;
		if (typeof scope !== 'string' || typeof sessionId !== 'string') {
			return true;
		}
		desktopRelayMappings[scope] = {
			scope,
			sessionId,
			expiresAt:
				Date.now() +
				(typeof ttl === 'number' && Number.isFinite(ttl)
					? ttl
					: 5 * 60 * 1000),
		};
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

export async function handleDesktopRelayRequest(
	event: FetchEvent,
	mapping: DesktopRelayMapping
) {
	const requestId = crypto.randomUUID();
	const unscopedUrl = removeURLScope(new URL(event.request.url));
	const body = await requestBodyToBase64(event.request);
	const response = await postRequestToDesktopClient(mapping, {
		type: 'desktop-relay-request',
		sessionId: mapping.sessionId,
		requestId,
		method: event.request.method,
		path: `${unscopedUrl.pathname}${unscopedUrl.search}`,
		headers: collectHeaders(event.request.headers),
		body,
	});
	return new Response(base64ToUint8Array(response.body || ''), {
		status: response.status,
		headers: new Headers(response.headers),
	});
}

async function requestBodyToBase64(
	request: Request
): Promise<string | undefined> {
	if (request.method === 'GET' || request.method === 'HEAD') {
		return undefined;
	}
	const buffer = await request.clone().arrayBuffer();
	if (buffer.byteLength === 0) {
		return undefined;
	}
	return uint8ArrayToBase64(new Uint8Array(buffer));
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
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
	const serviceWorker = self as unknown as ServiceWorkerGlobalScope;
	const clients = await serviceWorker.clients.matchAll({
		type: 'window',
		includeUncontrolled: true,
	});
	const client = clients.find((candidate: Client) => {
		try {
			return (
				new URL(candidate.url).searchParams.get('share') ===
				mapping.sessionId
			);
		} catch {
			return false;
		}
	});
	if (!client) {
		throw new Error('Desktop relay page is not available');
	}

	const channel = new MessageChannel();
	const result = new Promise<{
		status: number;
		headers: Record<string, string>;
		body: string;
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

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function base64ToUint8Array(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
