import { expect, test } from '../playground-fixtures.ts';

test('new iframes are SW-controlled (about:blank)', async ({ website }) => {
	await website.goto('./');
	// Ensure WordPress iframe is mounted
	await website.waitForNestedIframes();

	const result = await website.page.evaluate(async () => {
		const wpIframe = document.querySelector<HTMLIFrameElement>('#wp');
		if (!wpIframe || !wpIframe.contentWindow || !wpIframe.contentDocument) {
			throw new Error('WordPress iframe is not ready');
		}

		const wpDoc = wpIframe.contentDocument;
		const child = wpDoc.createElement('iframe');
		wpDoc.body.appendChild(child);

		const start = performance.now();
		while (performance.now() - start < 5000) {
			const controlled = child.getAttribute('data-controlled');
			const hasController = (() => {
				try {
					return !!child.contentWindow?.navigator?.serviceWorker
						?.controller;
				} catch {
					return false;
				}
			})();
			if (controlled === '1' && hasController) {
				return { controlled, hasController };
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		return {
			controlled: child.getAttribute('data-controlled'),
			hasController: (() => {
				try {
					return !!child.contentWindow?.navigator?.serviceWorker
						?.controller;
				} catch {
					return false;
				}
			})(),
		};
	});

	expect(result.controlled).toBe('1');
	expect(result.hasController).toBeTruthy();
});
