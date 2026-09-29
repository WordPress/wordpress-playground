import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPostMessageRelay } from './setup-post-message-relay';

describe('setupPostMessageRelay', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('ignores null messages from both relay directions', () => {
		const parentPostMessage = vi.fn();
		const nestedFramePostMessage = vi.fn();
		const parentWindow = {
			postMessage: parentPostMessage,
		} as unknown as Window;
		const nestedFrameWindow = {
			postMessage: nestedFramePostMessage,
		} as unknown as Window;
		const messageListeners: Array<(event: MessageEvent) => void> = [];
		vi.stubGlobal('window', {
			parent: parentWindow,
			addEventListener: (
				type: string,
				listener: (event: MessageEvent) => void
			) => {
				if (type === 'message') {
					messageListeners.push(listener);
				}
			},
		});

		setupPostMessageRelay({
			contentWindow: nestedFrameWindow,
		} as unknown as HTMLIFrameElement);

		expect(messageListeners.length).toBeGreaterThan(0);
		const nullMessages = [
			{
				data: null,
				source: nestedFrameWindow,
			} as MessageEvent,
			{
				data: null,
				source: parentWindow,
			} as MessageEvent,
		];
		for (const event of nullMessages) {
			expect(() => {
				for (const listener of messageListeners) {
					listener(event);
				}
			}).not.toThrow();
		}
		expect(parentPostMessage).not.toHaveBeenCalled();
		expect(nestedFramePostMessage).not.toHaveBeenCalled();
	});
});
