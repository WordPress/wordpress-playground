import { MessageChannel } from 'node:worker_threads';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestWordPressUrl } from './request-wordpress-url';

describe('requestWordPressUrl', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('reads the live URL through a port sent only to the WordPress origin', async () => {
		vi.stubGlobal('MessageChannel', MessageChannel);
		const postMessage = vi.fn((_message, _origin, ports) => {
			ports[0].postMessage(
				'https://wp.example/scope:123/wp-admin/edit.php'
			);
			ports[0].close();
		});
		const frame = {
			contentWindow: { postMessage },
		} as unknown as HTMLIFrameElement;

		const url = await requestWordPressUrl(frame, 'https://wp.example');

		expect(url).toBe('https://wp.example/scope:123/wp-admin/edit.php');
		expect(postMessage).toHaveBeenCalledWith(
			{ type: 'playground-request-url' },
			'https://wp.example',
			[expect.anything()]
		);
	});

	it('allows the fallback when a document does not reply', async () => {
		vi.stubGlobal('MessageChannel', MessageChannel);
		vi.useFakeTimers();
		const frame = {
			contentWindow: { postMessage: vi.fn() },
		} as unknown as HTMLIFrameElement;

		const pending = requestWordPressUrl(frame, 'https://wp.example');
		await vi.runAllTimersAsync();

		expect(await pending).toBeUndefined();
	});
});
