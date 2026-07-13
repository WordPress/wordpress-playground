// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenForPointerDownAcrossIframes } from './listen-for-pointer-down-across-iframes';

describe('listenForPointerDownAcrossIframes', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('receives pointer presses from a nested WordPress iframe', () => {
		const playgroundFrame = document.createElement('iframe');
		document.body.append(playgroundFrame);
		const wordpressFrame = document.createElement('iframe');
		playgroundFrame.contentDocument!.body.append(wordpressFrame);
		const listener = vi.fn();
		const stopListening = listenForPointerDownAcrossIframes(listener);

		wordpressFrame.contentDocument!.body.dispatchEvent(
			new MouseEvent('pointerdown', { bubbles: true })
		);

		expect(listener).toHaveBeenCalledOnce();
		stopListening();
	});

	it('tracks nested iframes added after the listener starts', async () => {
		const listener = vi.fn();
		const stopListening = listenForPointerDownAcrossIframes(listener);
		const playgroundFrame = document.createElement('iframe');
		document.body.append(playgroundFrame);
		await waitForMutationObservers();
		const wordpressFrame = document.createElement('iframe');
		playgroundFrame.contentDocument!.body.append(wordpressFrame);
		await waitForMutationObservers();

		wordpressFrame.contentDocument!.body.dispatchEvent(
			new MouseEvent('pointerdown', { bubbles: true })
		);

		expect(listener).toHaveBeenCalledOnce();
		stopListening();
	});

	it('removes document, iframe load, and mutation listeners', async () => {
		const listener = vi.fn();
		const stopListening = listenForPointerDownAcrossIframes(listener);
		stopListening();

		document.body.dispatchEvent(
			new MouseEvent('pointerdown', { bubbles: true })
		);
		const frame = document.createElement('iframe');
		document.body.append(frame);
		await waitForMutationObservers();
		frame.dispatchEvent(new Event('load'));
		frame.contentDocument!.body.dispatchEvent(
			new MouseEvent('pointerdown', { bubbles: true })
		);

		expect(listener).not.toHaveBeenCalled();
	});
});

async function waitForMutationObservers() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}
