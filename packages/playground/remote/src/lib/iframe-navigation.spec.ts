import { waitForIframeLoad } from './iframe-navigation';

describe('waitForIframeLoad', () => {
	it('resolves when the iframe loads', async () => {
		const iframe = Object.assign(new EventTarget(), {
			src: 'https://example.com/',
		}) as HTMLIFrameElement;
		const navigation = waitForIframeLoad(iframe);

		iframe.dispatchEvent(new Event('load'));

		await expect(navigation).resolves.toBeUndefined();
		expect(iframe.src).toBe('https://example.com/');
	});

	it('cancels navigation when the iframe does not load', async () => {
		vi.useFakeTimers();
		const iframe = Object.assign(new EventTarget(), {
			src: 'https://example.com/',
		}) as HTMLIFrameElement;
		const navigation = waitForIframeLoad(iframe, 100);
		const result = expect(navigation).rejects.toThrow(
			'Playground iframe navigation did not finish within 100ms.'
		);

		await vi.advanceTimersByTimeAsync(100);

		await result;
		expect(iframe.src).toBe('about:blank');
		vi.useRealTimers();
	});
});
