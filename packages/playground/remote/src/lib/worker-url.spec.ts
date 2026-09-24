import { sameOriginWorkerUrl } from './worker-url';

describe('sameOriginWorkerUrl', () => {
	it('keeps the worker on the site origin when its bundle is on the asset origin', () => {
		expect(
			sameOriginWorkerUrl(
				'http://static.playground.localhost:9400/release/worker.js',
				'http://site-aaaa.playground.localhost:9400/remote.html'
			).href
		).toBe('http://site-aaaa.playground.localhost:9400/release/worker.js');
	});

	it('preserves Vite worker query parameters and relative paths', () => {
		expect(
			sameOriginWorkerUrl(
				'./worker.ts?worker_file&type=module',
				'http://localhost:5400/src/remote.html'
			).href
		).toBe('http://localhost:5400/src/worker.ts?worker_file&type=module');
	});
});
