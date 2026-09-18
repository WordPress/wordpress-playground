import { describe, it, expect, vi } from 'vitest';
import { PHPResponse } from '@php-wasm/universal';
import type { PHPRequest } from '@php-wasm/universal';
import { LoadBalancer } from '../src/load-balancer';

/**
 * Creates a mock worker whose .request() calls can be
 * individually resolved or rejected from the test.
 */
function createControllableWorker() {
	const log: {
		request: PHPRequest;
		resolve: (r: PHPResponse) => void;
		reject: (e: unknown) => void;
	}[] = [];

	const request = vi.fn(
		(req: PHPRequest) =>
			new Promise<PHPResponse>((resolve, reject) => {
				log.push({ request: req, resolve, reject });
			})
	);

	return { request, log };
}

describe('LoadBalancer', () => {
	describe('no backpressure', () => {
		it('resolves requests', async () => {
			const w1 = createControllableWorker();
			const w2 = createControllableWorker();
			const lb = new LoadBalancer([w1, w2]);

			const p1 = lb.handleRequest({ url: '/a' });
			const p2 = lb.handleRequest({ url: '/b' });

			const r1 = new PHPResponse(200, {}, new Uint8Array());
			const r2 = new PHPResponse(201, {}, new Uint8Array());
			w1.log[0].resolve(r1);
			w2.log[0].resolve(r2);

			expect(await p1).toEqual(r1);
			expect(await p2).toEqual(r2);
		});

		it('rejects requests', async () => {
			const w1 = createControllableWorker();
			const w2 = createControllableWorker();
			const lb = new LoadBalancer([w1, w2]);

			const p1 = lb.handleRequest({ url: '/a' });
			const p2 = lb.handleRequest({ url: '/b' });

			w1.log[0].reject(new Error('err1'));
			w2.log[0].reject(new Error('err2'));

			await expect(p1).rejects.toThrow('err1');
			await expect(p2).rejects.toThrow('err2');
		});
	});

	describe('with backpressure', () => {
		it('resolves queued requests in order', async () => {
			const w1 = createControllableWorker();
			const w2 = createControllableWorker();
			const lb = new LoadBalancer([w1, w2]);

			const p1 = lb.handleRequest({ url: '/first' });
			const p2 = lb.handleRequest({ url: '/second' });
			const p3 = lb.handleRequest({ url: '/third' });
			const p4 = lb.handleRequest({ url: '/fourth' });

			// /first and /second dispatched; /third and /fourth
			// are queued.
			expect(w1.request).toHaveBeenCalledTimes(1);
			expect(w2.request).toHaveBeenCalledTimes(1);

			const r1 = new PHPResponse(200, {}, new Uint8Array());
			w1.log[0].resolve(r1);
			expect(await p1).toEqual(r1);

			// /third is now dispatched to w1.
			expect(w1.request).toHaveBeenCalledTimes(2);
			expect(w1.log[1].request.url).toEqual('/third');

			const r2 = new PHPResponse(201, {}, new Uint8Array());
			w2.log[0].resolve(r2);
			expect(await p2).toEqual(r2);

			// /fourth is now dispatched to w2.
			expect(w2.request).toHaveBeenCalledTimes(2);
			expect(w2.log[1].request.url).toEqual('/fourth');

			const r3 = new PHPResponse(202, {}, new Uint8Array());
			w1.log[1].resolve(r3);
			expect(await p3).toEqual(r3);

			const r4 = new PHPResponse(203, {}, new Uint8Array());
			w2.log[1].resolve(r4);
			expect(await p4).toEqual(r4);
		});

		it('rejects queued requests in order', async () => {
			const w1 = createControllableWorker();
			const w2 = createControllableWorker();
			const lb = new LoadBalancer([w1, w2]);

			const p1 = lb.handleRequest({ url: '/first' });
			const p2 = lb.handleRequest({ url: '/second' });
			const p3 = lb.handleRequest({ url: '/third' });
			const p4 = lb.handleRequest({ url: '/fourth' });

			expect(w1.request).toHaveBeenCalledTimes(1);
			expect(w2.request).toHaveBeenCalledTimes(1);

			w1.log[0].reject(new Error('err1'));
			await expect(p1).rejects.toThrow('err1');

			// /third is now dispatched to w1.
			expect(w1.request).toHaveBeenCalledTimes(2);
			expect(w1.log[1].request.url).toEqual('/third');

			w2.log[0].reject(new Error('err2'));
			await expect(p2).rejects.toThrow('err2');

			// /fourth is now dispatched to w2.
			expect(w2.request).toHaveBeenCalledTimes(2);
			expect(w2.log[1].request.url).toEqual('/fourth');

			w1.log[1].reject(new Error('err3'));
			await expect(p3).rejects.toThrow('err3');

			w2.log[1].reject(new Error('err4'));
			await expect(p4).rejects.toThrow('err4');
		});

		it('services the queue after a rejection', async () => {
			const w1 = createControllableWorker();
			const w2 = createControllableWorker();
			const lb = new LoadBalancer([w1, w2]);

			const p1 = lb.handleRequest({ url: '/fail' });
			const p2 = lb.handleRequest({ url: '/ok' });
			const p3 = lb.handleRequest({ url: '/queued' });

			// All workers have received one request.
			// The third should be queued.
			expect(w1.request).toHaveBeenCalledTimes(1);
			expect(w2.request).toHaveBeenCalledTimes(1);

			w1.log[0].reject(new Error('crash'));
			await expect(p1).rejects.toThrow('crash');

			// The queued request should be dispatched to w1 now
			// that it's free again.
			expect(w1.request).toHaveBeenCalledTimes(2);
			expect(w1.log[1].request.url).toEqual('/queued');

			const r2 = new PHPResponse(200, {}, new Uint8Array());
			w2.log[0].resolve(r2);
			expect(await p2).toEqual(r2);

			const r3 = new PHPResponse(201, {}, new Uint8Array());
			w1.log[1].resolve(r3);
			expect(await p3).toEqual(r3);
		});
	});
});
