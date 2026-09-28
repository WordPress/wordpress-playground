// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

it('retries the catalogue frame after its load times out', async () => {
	vi.resetModules();
	vi.useFakeTimers();
	const { updateOriginCatalogue } = await import('./origin-isolation');
	const failed = expect(updateOriginCatalogue()).rejects.toThrow(
		'Could not load'
	);
	await vi.advanceTimersByTimeAsync(30000);
	await failed;
	expect(document.querySelector('iframe')).toBeNull();

	const retried = updateOriginCatalogue();
	const frame = document.querySelector('iframe')!;
	expect(frame).not.toBeNull();
	vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(
		(message) => {
			window.dispatchEvent(
				new MessageEvent('message', {
					source: frame.contentWindow,
					origin: new URL(frame.src).origin,
					data: { id: message.id, value: [] },
				})
			);
		}
	);
	frame.dispatchEvent(new Event('load'));
	await expect(retried).resolves.toEqual([]);
});
