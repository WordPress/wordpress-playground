import { describe, expect, it, vi } from 'vitest';
import { windowEndpoint } from './comlink-sync';

// The parent API must reject sibling/child frames even if they know the RPC format.
describe('windowEndpoint', () => {
	it('receives messages only from its connected window', () => {
		const context = new EventTarget();
		const peer = { postMessage: vi.fn() };
		const endpoint = windowEndpoint(peer, context);
		const listener = vi.fn();
		endpoint.addEventListener('message', listener);
		endpoint.addEventListener('message', listener);
		for (const source of [{ postMessage: vi.fn() }, peer]) {
			const event = new Event('message');
			Object.defineProperty(event, 'source', { value: source });
			context.dispatchEvent(event);
		}
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener.mock.calls[0][0].source).toBe(peer);
		expect(listener.mock.contexts).toEqual([context]);
		endpoint.removeEventListener('message', listener);
		const event = new Event('message');
		Object.defineProperty(event, 'source', { value: peer });
		context.dispatchEvent(event);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('supports handleEvent listeners and preserves the outgoing target origin', () => {
		const context = new EventTarget();
		const peer = { postMessage: vi.fn() };
		const endpoint = windowEndpoint(peer, context, 'https://app.example');
		const listener = { handleEvent: vi.fn() };
		endpoint.addEventListener('message', listener);
		const event = new Event('message');
		Object.defineProperty(event, 'source', { value: peer });
		context.dispatchEvent(event);
		expect(listener.handleEvent).toHaveBeenCalledWith(event);
		expect(listener.handleEvent.mock.contexts).toEqual([listener]);
		endpoint.postMessage('request', []);
		expect(peer.postMessage).toHaveBeenCalledWith(
			'request',
			'https://app.example',
			[]
		);
	});
});
