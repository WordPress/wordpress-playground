/// <reference lib="WebWorker" />

import { isURLScoped, removeURLScope, setURLScope } from '@php-wasm/scopes';

export type RemoteAccessRelayMapping = {
	scope: string;
	sessionId: string;
	clientId?: string;
	cookies?: Record<string, string>;
	interceptedRequests: number;
	lastInterceptedPath?: string;
	expiresAt: number;
};

const remoteAccessRelayMappings: Record<string, RemoteAccessRelayMapping> = {};
const DEFAULT_RELAY_MAPPING_TTL_MS = 5 * 60 * 1000;
const MAX_RELAY_MAPPING_TTL_MS = 5 * 60 * 1000;

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
		const ttlMs = getSafeRelayMappingTtl(ttl);
		remoteAccessRelayMappings[scope] = {
			scope,
			sessionId,
			clientId: getSourceClientId(event),
			cookies: existing?.cookies,
			interceptedRequests: existing?.interceptedRequests ?? 0,
			lastInterceptedPath: existing?.lastInterceptedPath,
			expiresAt: Date.now() + ttlMs,
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

function getSafeRelayMappingTtl(ttl: unknown): number {
	if (typeof ttl !== 'number' || !Number.isFinite(ttl)) {
		return DEFAULT_RELAY_MAPPING_TTL_MS;
	}
	return Math.min(Math.max(ttl, 1), MAX_RELAY_MAPPING_TTL_MS);
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
		cookies: existing?.cookies,
		interceptedRequests: existing?.interceptedRequests ?? 0,
		lastInterceptedPath: existing?.lastInterceptedPath,
		expiresAt: Date.now() + DEFAULT_RELAY_MAPPING_TTL_MS,
	};
	return remoteAccessRelayMappings[scope];
}

export function handleRemoteAccessRelayProbe(
	scope: string,
	sessionId: string | null
): Response {
	const mapping = getRemoteAccessRelayMapping(scope);
	if (!mapping || mapping.sessionId !== sessionId) {
		return new Response(
			JSON.stringify({
				ok: false,
				scope,
				hasMapping: false,
				clientId: null,
				interceptedRequests: 0,
				lastInterceptedPath: null,
			}),
			{
				status: 404,
				headers: {
					'Content-Type': 'application/json',
					'X-Remote-Access-Service-Worker': '1',
				},
			}
		);
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
	const headers = collectHeaders(event.request.headers);
	applyRemoteAccessCookies(mapping, headers);
	const response = await postRequestToRemoteAccessClient(mapping, {
		type: 'remote-access-relay-request',
		sessionId: mapping.sessionId,
		requestId,
		method: event.request.method,
		path,
		headers,
		body,
	});
	storeRemoteAccessCookies(mapping, response.cookies);
	return createRemoteAccessRelayResponse(
		event.request.url,
		mapping,
		response
	);
}

export function createRemoteAccessRelayResponse(
	requestUrl: string,
	mapping: RemoteAccessRelayMapping,
	response: {
		status: number;
		headers: Record<string, string>;
		body?: Uint8Array;
		cookies?: string[];
	}
): Response {
	const headers = new Headers(response.headers);
	sanitizeRemoteAccessRelayResponseHeaders(headers);
	const location = headers.get('location');
	if (isRedirectStatus(response.status) && location) {
		let redirectTarget = new URL(location, requestUrl);
		if (!isURLScoped(redirectTarget)) {
			redirectTarget = setURLScope(redirectTarget, mapping.scope);
		}
		return Response.redirect(redirectTarget.toString(), response.status);
	}

	const body = isNullBodyStatus(response.status)
		? null
		: getRemoteAccessRelayResponseBody(
				requestUrl,
				mapping,
				headers,
				response.body
			);
	return new Response(body, {
		status: response.status,
		headers,
	});
}

function sanitizeRemoteAccessRelayResponseHeaders(headers: Headers): void {
	for (const header of [
		'connection',
		'content-length',
		'keep-alive',
		'transfer-encoding',
	]) {
		headers.delete(header);
	}
}

function getRemoteAccessRelayResponseBody(
	requestUrl: string,
	mapping: RemoteAccessRelayMapping,
	headers: Headers,
	body: Uint8Array | undefined
): Uint8Array {
	if (!body) {
		return new Uint8Array();
	}
	if (!isHtmlResponse(headers)) {
		return body;
	}
	const html = new TextDecoder().decode(body);
	return new TextEncoder().encode(
		scopeRemoteAccessHtmlUrls(requestUrl, mapping, html)
	);
}

function isHtmlResponse(headers: Headers): boolean {
	return (
		headers.get('content-type')?.toLowerCase().includes('text/html') ??
		false
	);
}

export function scopeRemoteAccessHtmlUrls(
	requestUrl: string,
	mapping: RemoteAccessRelayMapping,
	html: string
): string {
	return html.replace(
		/\b(href|src|action)=("|')([^"']*)\2/gi,
		(match, attribute: string, quote: string, value: string) => {
			const scopedUrl = scopeRemoteAccessHtmlUrl(
				requestUrl,
				mapping,
				value
			);
			if (!scopedUrl) {
				return match;
			}
			return `${attribute}=${quote}${scopedUrl}${quote}`;
		}
	);
}

function scopeRemoteAccessHtmlUrl(
	requestUrl: string,
	mapping: RemoteAccessRelayMapping,
	value: string
): string | null {
	if (
		value === '' ||
		value.startsWith('#') ||
		value.startsWith('mailto:') ||
		value.startsWith('tel:') ||
		value.startsWith('javascript:')
	) {
		return null;
	}
	const request = new URL(requestUrl);
	const url = new URL(value, request);
	if (url.origin !== request.origin) {
		return null;
	}
	if (isURLScoped(url)) {
		return isRootRelativeUrl(value) || isAbsoluteUrl(value)
			? null
			: url.toString();
	}
	return setURLScope(url, mapping.scope).toString();
}

function isRootRelativeUrl(value: string): boolean {
	return value.startsWith('/');
}

function isAbsoluteUrl(value: string): boolean {
	return /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//');
}

export function applyRemoteAccessCookies(
	mapping: RemoteAccessRelayMapping,
	headers: Record<string, string>
): void {
	const cookies = Object.entries(mapping.cookies || {});
	if (cookies.length === 0) {
		return;
	}
	const cookieHeader = cookies
		.map(([name, value]) => `${name}=${value}`)
		.join('; ');
	headers['cookie'] = headers['cookie']
		? `${headers['cookie']}; ${cookieHeader}`
		: cookieHeader;
}

export function storeRemoteAccessCookies(
	mapping: RemoteAccessRelayMapping,
	cookies: string[] | undefined
): void {
	if (!cookies?.length) {
		return;
	}
	mapping.cookies ??= {};
	for (const cookie of cookies) {
		const parsed = parseSetCookieHeader(cookie);
		if (!parsed) {
			continue;
		}
		if (parsed.expires) {
			delete mapping.cookies[parsed.name];
		} else {
			mapping.cookies[parsed.name] = parsed.value;
		}
	}
}

function parseSetCookieHeader(
	cookie: string
): { name: string; value: string; expires: boolean } | null {
	const [nameValue, ...attributes] = cookie.split(';');
	const separatorIndex = nameValue.indexOf('=');
	if (separatorIndex <= 0) {
		return null;
	}
	const name = nameValue.slice(0, separatorIndex).trim();
	const value = nameValue.slice(separatorIndex + 1).trim();
	if (!name) {
		return null;
	}
	const expires = attributes.some((attribute) => {
		const normalized = attribute.trim().toLowerCase();
		if (normalized === 'max-age=0') {
			return true;
		}
		if (!normalized.startsWith('expires=')) {
			return false;
		}
		const timestamp = Date.parse(
			attribute.slice(attribute.indexOf('=') + 1)
		);
		return Number.isFinite(timestamp) && timestamp <= Date.now();
	});
	return { name, value, expires };
}

function isRedirectStatus(
	status: number
): status is 301 | 302 | 303 | 307 | 308 {
	return [301, 302, 303, 307, 308].includes(status);
}

function isNullBodyStatus(status: number): boolean {
	return [101, 103, 204, 205, 304].includes(status);
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
	cookies?: string[];
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
	cookies?: string[];
}> {
	const channel = new MessageChannel();
	const result = new Promise<{
		status: number;
		headers: Record<string, string>;
		body: Uint8Array;
		cookies?: string[];
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
