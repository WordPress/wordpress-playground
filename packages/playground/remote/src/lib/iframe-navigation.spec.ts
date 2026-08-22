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

	it('removes a timed-out navigation listener before the following navigation', async () => {
		vi.useFakeTimers();
		const iframe = Object.assign(new EventTarget(), {
			src: 'https://example.com/first',
		}) as HTMLIFrameElement;
		const firstNavigation = waitForIframeLoad(iframe, 100);
		const firstResult = expect(firstNavigation).rejects.toThrow(
			'Playground iframe navigation did not finish within 100ms.'
		);

		await vi.advanceTimersByTimeAsync(100);
		await firstResult;

		iframe.src = 'https://example.com/second';
		const secondNavigation = waitForIframeLoad(iframe, 100);
		iframe.dispatchEvent(new Event('load'));

		await expect(secondNavigation).resolves.toBeUndefined();
		vi.useRealTimers();
	});
});
