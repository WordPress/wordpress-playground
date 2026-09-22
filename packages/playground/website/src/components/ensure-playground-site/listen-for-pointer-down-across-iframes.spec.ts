// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenForPointerDownAcrossIframes } from './listen-for-pointer-down-across-iframes';

describe('listenForPointerDownAcrossIframes', () => {
	afterEach(() => {
		vi.restoreAllMocks();
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

	it('stops listening in the previous document after an iframe navigates', () => {
		const frame = document.createElement('iframe');
		const firstDocument =
			document.implementation.createHTMLDocument('first');
		const secondDocument =
			document.implementation.createHTMLDocument('second');
		let frameDocument = firstDocument;
		Object.defineProperty(frame, 'contentDocument', {
			configurable: true,
			get: () => frameDocument,
		});
		document.body.append(frame);
		const listener = vi.fn();
		const stopListening = listenForPointerDownAcrossIframes(listener);

		firstDocument.body.dispatchEvent(
			new MouseEvent('pointerdown', { bubbles: true })
		);
		frameDocument = secondDocument;
		frame.dispatchEvent(new Event('load'));
		firstDocument.body.dispatchEvent(
			new MouseEvent('pointerdown', { bubbles: true })
		);
		secondDocument.body.dispatchEvent(
			new MouseEvent('pointerdown', { bubbles: true })
		);

		expect(listener).toHaveBeenCalledTimes(2);
		stopListening();
	});

	it('does not rescan a document when an unrelated element is added', async () => {
		const listener = vi.fn();
		const querySelectorAll = vi.spyOn(document, 'querySelectorAll');
		const stopListening = listenForPointerDownAcrossIframes(listener);
		querySelectorAll.mockClear();

		document.body.append(document.createElement('div'));
		await waitForMutationObservers();

		expect(querySelectorAll).not.toHaveBeenCalled();
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
