import { describe, expect, it } from 'vitest';
import {
	applyRemoteAccessCookies,
	collectHeaders,
	createRemoteAccessRelayResponse,
	getRemoteAccessRelayMapping,
	getRemoteAccessRelayMappingFromUrl,
	handleRemoteAccessRelayProbe,
	requestBodyToBytes,
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

		expect(
			handleRemoteAccessRelayProbe('probe-test', 'other-session').status
		).toBe(404);
		expect(handleRemoteAccessRelayProbe('missing-test', null).status).toBe(
			404
		);
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
});
