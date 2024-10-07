import { cloneRequest, getRequestHeaders } from './utils';

describe('cloneRequest', () => {
	it('should clone request headers', async () => {
		const request = new Request('http://localhost', {
			headers: {
				'Content-Type': 'text/plain',
				'X-Wp-Nonce': '123456',
			},
		});
		const cloned = await cloneRequest(request, {});
		expect(cloned.headers.get('content-type')).toBe('text/plain');
		expect(cloned.headers.get('x-wp-nonce')).toBe('123456');
	});
});

describe('getRequestHeaders', () => {
	it('should extract request headers', async () => {
		const request = new Request('http://localhost', {
			headers: {
				'Content-Type': 'text/plain',
				'X-Wp-Nonce': '123456',
			},
		});
		expect(getRequestHeaders(request)).toEqual({
			'content-type': 'text/plain',
			'x-wp-nonce': '123456',
		});
	});
});
