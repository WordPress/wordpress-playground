import { isMessageFromIframeTree } from './iframe-messages';

function windowWithFrames(children: Window[] = []): Window {
	return { frames: children } as unknown as Window;
}

function messageFrom(source: Window | null): MessageEvent {
	return { source } as MessageEvent;
}

function iframeWithWindow(contentWindow: Window): HTMLIFrameElement {
	return { contentWindow } as HTMLIFrameElement;
}

describe('isMessageFromIframeTree', () => {
	it('accepts a message from the iframe window', () => {
		const root = windowWithFrames();

		expect(
			isMessageFromIframeTree(messageFrom(root), iframeWithWindow(root))
		).toBe(true);
	});

	it('accepts a message from a nested iframe window', () => {
		const nested = windowWithFrames();
		const child = windowWithFrames([nested]);
		const root = windowWithFrames([child]);

		expect(
			isMessageFromIframeTree(messageFrom(nested), iframeWithWindow(root))
		).toBe(true);
	});

	it('rejects a message from an unrelated window', () => {
		const root = windowWithFrames([windowWithFrames()]);
		const unrelated = windowWithFrames();

		expect(
			isMessageFromIframeTree(
				messageFrom(unrelated),
				iframeWithWindow(root)
			)
		).toBe(false);
	});

	it('rejects a source when the iframe tree cannot be inspected', () => {
		const root = Object.defineProperty({}, 'frames', {
			get() {
				throw new DOMException('Blocked by cross-origin policy');
			},
		}) as Window;

		expect(
			isMessageFromIframeTree(
				messageFrom(windowWithFrames()),
				iframeWithWindow(root)
			)
		).toBe(false);
	});

	it('rejects missing iframe and message windows', () => {
		const root = windowWithFrames();

		expect(isMessageFromIframeTree(messageFrom(root), null)).toBe(false);
		expect(
			isMessageFromIframeTree(messageFrom(null), iframeWithWindow(root))
		).toBe(false);
	});
});
