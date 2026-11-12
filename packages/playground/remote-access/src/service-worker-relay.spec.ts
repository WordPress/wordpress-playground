import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	applyRemoteAccessCookies,
	collectHeaders,
	createRemoteAccessRelayResponse,
	getRemoteAccessRelayMapping,
	getRemoteAccessRelayMappingFromUrl,
	handleRemoteAccessRelayMessage,
	handleRemoteAccessRelayProbe,
	handleRemoteAccessRelayRequest,
	requestBodyToBytes,
	scopeRemoteAccessHtmlUrls,
	storeRemoteAccessCookies,
} from './service-worker-relay';

describe('remote access service worker relay helpers', () => {
	it('does not read bodies for GET and HEAD requests', async () => {
		await expect(
			requestBodyToBytes(
				new Request('https://example.com/', { method: 'GET' })
			)
		).resolves.toBeUndefined();
		await expect(
			requestBodyToBytes(
				new Request('https://example.com/', { method: 'HEAD' })
			)
		).resolves.toBeUndefined();
	});

	it('returns undefined for empty non-GET request bodies', async () => {
		await expect(
			requestBodyToBytes(
				new Request('https://example.com/', {
					method: 'POST',
					body: new Uint8Array(),
				})
			)
		).resolves.toBeUndefined();
	});

	it('returns binary request bodies without base64 conversion', async () => {
		const bytes = await requestBodyToBytes(
			new Request('https://example.com/', {
				method: 'POST',
				body: new Uint8Array([0, 1, 2, 253, 254, 255]),
			})
		);

		expect(Array.from(bytes || [])).toEqual([0, 1, 2, 253, 254, 255]);
	});

	it('collects headers into a plain record', () => {
		const headers = collectHeaders(
			new Headers([
				['Content-Type', 'text/plain'],
				['X-Request-Id', 'abc'],
			])
		);

		expect(headers).toEqual({
			'content-type': 'text/plain',
			'x-request-id': 'abc',
		});
	});

	it('recovers and persists a relay mapping from a scoped viewer URL', () => {
		const mapping = getRemoteAccessRelayMappingFromUrl(
			'default',
			new URL(
				'https://example.com/scope:default/?remote-access-view=session-1'
			)
		);

		expect(mapping?.sessionId).toBe('session-1');
		expect(getRemoteAccessRelayMapping('default')?.sessionId).toBe(
			'session-1'
		);
	});

	it('only returns probe diagnostics for the mapped session id', async () => {
		getRemoteAccessRelayMappingFromUrl(
			'probe-test',
			new URL(
				'https://example.com/scope:probe-test/?remote-access-view=session-probe'
			)
		);

		const response = handleRemoteAccessRelayProbe(
			'probe-test',
			'session-probe'
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('X-Remote-Access-Service-Worker')).toBe(
			'1'
		);
		await expect(response.json()).resolves.toMatchObject({
			hasMapping: true,
			interceptedRequests: 0,
			lastInterceptedPath: null,
		});

		const mismatchedResponse = handleRemoteAccessRelayProbe(
			'probe-test',
			'other-session'
		);
		expect(mismatchedResponse.status).toBe(404);
		expect(
			mismatchedResponse.headers.get('X-Remote-Access-Service-Worker')
		).toBe('1');
		await expect(mismatchedResponse.json()).resolves.toMatchObject({
			hasMapping: false,
			interceptedRequests: 0,
			lastInterceptedPath: null,
		});

		const missingResponse = handleRemoteAccessRelayProbe(
			'missing-test',
			null
		);
		expect(missingResponse.status).toBe(404);
		expect(
			missingResponse.headers.get('X-Remote-Access-Service-Worker')
		).toBe('1');
	});

	it('keeps remote access redirects inside the scoped iframe', () => {
		const response = createRemoteAccessRelayResponse(
			'https://example.com/scope:default/wp-admin/edit.php',
			{
				scope: 'default',
				sessionId: 'session-redirect',
				interceptedRequests: 0,
				expiresAt: Date.now() + 1000,
			},
			{
				status: 302,
				headers: {
					location: '/wp-admin/post.php?post=1&action=edit',
				},
				body: new Uint8Array(),
			}
		);

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe(
			'https://example.com/scope:default/wp-admin/post.php?post=1&action=edit'
		);
	});

	it('does not attach a body to null-body responses', async () => {
		const response = createRemoteAccessRelayResponse(
			'https://example.com/scope:default/wp-admin/',
			{
				scope: 'default',
				sessionId: 'session-null-body',
				interceptedRequests: 0,
				expiresAt: Date.now() + 1000,
			},
			{
				status: 304,
				headers: {
					etag: '"abc"',
				},
				body: new Uint8Array([1, 2, 3]),
			}
		);

		expect(response.status).toBe(304);
		await expect(response.text()).resolves.toBe('');
	});

	it('removes transport and body-size headers from synthesized responses', async () => {
		const response = createRemoteAccessRelayResponse(
			'https://example.com/scope:default/my-admin/',
			{
				scope: 'default',
				sessionId: 'session-headers',
				interceptedRequests: 0,
				expiresAt: Date.now() + 1000,
			},
			{
				status: 200,
				headers: {
					'content-type': 'text/html',
					'content-length': '10',
					connection: 'keep-alive',
					'transfer-encoding': 'chunked',
				},
				body: new TextEncoder().encode(
					'<a href="/my-admin/">Admin</a>'
				),
			}
		);

		expect(response.headers.get('content-type')).toBe('text/html');
		expect(response.headers.has('content-length')).toBe(false);
		expect(response.headers.has('connection')).toBe(false);
		expect(response.headers.has('transfer-encoding')).toBe(false);
		await expect(response.text()).resolves.toContain(
			'https://example.com/scope:default/my-admin/'
		);
	});

	it('stores response cookies and sends them on later relay requests', () => {
		const mapping = {
			scope: 'default',
			sessionId: 'session-cookies',
			interceptedRequests: 0,
			expiresAt: Date.now() + 1000,
		};

		storeRemoteAccessCookies(mapping, [
			'wordpress_logged_in=abc123; Path=/; HttpOnly',
			'wordpress_test_cookie=WP%20Cookie%20check; Path=/',
		]);

		const headers = { cookie: 'existing=value' };
		applyRemoteAccessCookies(mapping, headers);

		expect(headers.cookie).toBe(
			'existing=value; wordpress_logged_in=abc123; wordpress_test_cookie=WP%20Cookie%20check'
		);

		storeRemoteAccessCookies(mapping, [
			'wordpress_logged_in=deleted; Max-Age=0; Path=/',
		]);
		const nextHeaders: Record<string, string> = {};
		applyRemoteAccessCookies(mapping, nextHeaders);

		expect(nextHeaders.cookie).toBe(
			'wordpress_test_cookie=WP%20Cookie%20check'
		);
	});

	it('scopes same-origin HTML links and form actions', () => {
		const mapping = {
			scope: 'default',
			sessionId: 'session-html',
			interceptedRequests: 0,
			expiresAt: Date.now() + 1000,
		};
		const html = scopeRemoteAccessHtmlUrls(
			'https://example.com/scope:default/my-admin/',
			mapping,
			[
				'<a href="/my-admin/">Admin</a>',
				'<a href="post.php?id=1">Post</a>',
				'<form action="/wp-admin/admin-post.php"></form>',
				'<img src="https://example.com/wp-content/uploads/a.png">',
				'<a href="https://example.com/scope:default/already/">Scoped</a>',
				'<a href="https://wordpress.org/">External</a>',
				'<a href="#section">Hash</a>',
			].join('')
		);

		expect(html).toContain(
			'href="https://example.com/scope:default/my-admin/"'
		);
		expect(html).toContain(
			'href="https://example.com/scope:default/my-admin/post.php?id=1"'
		);
		expect(html).toContain(
			'action="https://example.com/scope:default/wp-admin/admin-post.php"'
		);
		expect(html).toContain(
			'src="https://example.com/scope:default/wp-content/uploads/a.png"'
		);
		expect(html).toContain(
			'href="https://example.com/scope:default/already/"'
		);
		expect(html).toContain('href="https://wordpress.org/"');
		expect(html).toContain('href="#section"');
	});
});

describe('remote access service worker relay scopes', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps concurrent relay scopes isolated', async () => {
		const clients = stubRelayClients();
		postRelayMessage('client-a', mapMessage('concurrent-a', 'session-a'));
		postRelayMessage('client-b', mapMessage('concurrent-b', 'session-b'));

		await relay('concurrent-a', ['a_auth=1; Path=/']);
		await relay('concurrent-b');
		await relay('concurrent-a');

		expect(clients.received).toEqual([
			{ clientId: 'client-a', sessionId: 'session-a', cookie: undefined },
			{ clientId: 'client-b', sessionId: 'session-b', cookie: undefined },
			{
				clientId: 'client-a',
				sessionId: 'session-a',
				cookie: 'a_auth=1',
			},
		]);
	});

	it('keeps cookies when the same session refreshes its mapping', async () => {
		const clients = stubRelayClients();
		postRelayMessage('client-a', mapMessage('reconnect', 'session-a'));
		await relay('reconnect', ['auth=1; Path=/']);

		postRelayMessage('client-a', mapMessage('reconnect', 'session-a'));
		await relay('reconnect');

		expect(clients.received.at(-1)).toEqual({
			clientId: 'client-a',
			sessionId: 'session-a',
			cookie: 'auth=1',
		});
	});

	it('drops cookies, including in-flight ones, when the session changes', async () => {
		const clients = stubRelayClients();
		postRelayMessage('client-a', mapMessage('session-change', 'session-a'));
		await relay('session-change', ['auth=1; Path=/']);

		const inFlight = relay('session-change', ['late=1; Path=/']);
		postRelayMessage('client-a', mapMessage('session-change', 'session-b'));
		await inFlight;
		await relay('session-change');

		expect(clients.received.slice(1)).toEqual([
			{ clientId: 'client-a', sessionId: 'session-a', cookie: 'auth=1' },
			{ clientId: 'client-a', sessionId: 'session-b', cookie: undefined },
		]);
	});

	it('does not let another client replace or clear a mapping', () => {
		postRelayMessage('client-a', mapMessage('owned', 'session-a'));

		const reply = postRelayMessage(
			'client-b',
			mapMessage('owned', 'session-b')
		);
		postRelayMessage('client-b', {
			type: 'remote-access-relay-clear',
			scope: 'owned',
		});

		expect(reply).toMatchObject({ type: 'remote-access-relay-map-error' });
		expect(getRemoteAccessRelayMapping('owned')).toMatchObject({
			sessionId: 'session-a',
			clientId: 'client-a',
		});

		postRelayMessage('client-a', {
			type: 'remote-access-relay-clear',
			scope: 'owned',
		});
		expect(getRemoteAccessRelayMapping('owned')).toBeUndefined();
	});

	it('does not let a viewer URL replace an existing mapping', () => {
		postRelayMessage('client-a', mapMessage('url-owned', 'session-a'));

		getRemoteAccessRelayMappingFromUrl(
			'url-owned',
			new URL(
				'https://example.com/scope:url-owned/?remote-access-view=session-b'
			)
		);

		expect(getRemoteAccessRelayMapping('url-owned')).toMatchObject({
			sessionId: 'session-a',
			clientId: 'client-a',
		});
	});
});

function mapMessage(scope: string, sessionId: string) {
	return { type: 'remote-access-relay-map', scope, sessionId };
}

function postRelayMessage(clientId: string, data: Record<string, unknown>) {
	let reply: unknown;
	handleRemoteAccessRelayMessage({
		data,
		source: { id: clientId },
		ports: [{ postMessage: (message: unknown) => (reply = message) }],
	} as unknown as ExtendableMessageEvent);
	return reply;
}

/**
 * Stubs the service worker's window clients. Each client answers relay
 * requests with the Set-Cookie headers passed to relay() for that request.
 */
function stubRelayClients() {
	const received: Array<{
		clientId: string;
		sessionId: string;
		cookie?: string;
	}> = [];
	const getClient = async (id: string) => ({
		id,
		postMessage: (
			message: {
				sessionId: string;
				headers: Record<string, string>;
				path: string;
			},
			[port]: MessagePort[]
		) => {
			received.push({
				clientId: id,
				sessionId: message.sessionId,
				cookie: message.headers['cookie'],
			});
			const cookies = new URL(
				message.path,
				'https://example.com'
			).searchParams.getAll('set-cookie');
			setTimeout(() =>
				port.postMessage({
					type: 'remote-access-relay-response',
					response: { status: 200, headers: {}, cookies },
				})
			);
		},
	});
	vi.stubGlobal('self', { clients: { get: getClient } });
	return { received };
}

async function relay(scope: string, setCookies: string[] = []) {
	const url = new URL(`https://example.com/scope:${scope}/wp-admin/`);
	for (const cookie of setCookies) {
		url.searchParams.append('set-cookie', cookie);
	}
	const mapping = getRemoteAccessRelayMapping(scope)!;
	const response = await handleRemoteAccessRelayRequest(
		{ request: new Request(url) } as FetchEvent,
		mapping
	);
	expect(response.status).toBe(200);
}
