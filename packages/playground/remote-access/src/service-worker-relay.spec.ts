import { describe, expect, it } from 'vitest';
import { collectHeaders, requestBodyToBytes } from './service-worker-relay';

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
});
