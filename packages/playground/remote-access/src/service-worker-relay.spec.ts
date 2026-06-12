import { describe, expect, it } from 'vitest';
import {
	collectHeaders,
	getRemoteAccessRelayMapping,
	getRemoteAccessRelayMappingFromUrl,
	handleRemoteAccessRelayProbe,
	requestBodyToBytes,
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
});
