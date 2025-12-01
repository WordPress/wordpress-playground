import { expect, test } from '../playground-fixtures.ts';

test('new iframes are SW-controlled (about:blank)', async ({ website }) => {
	await website.goto('./');
	// Ensure WordPress iframe is mounted
	await website.waitForNestedIframes();

	// Force update the service worker to ensure we have the latest version
	await website.page.evaluate(async () => {
		const registrations = await navigator.serviceWorker.getRegistrations();
		for (const reg of registrations) {
			await reg.update();
		}
		// Wait a moment for the SW to be active
		await new Promise((r) => setTimeout(r, 1000));
	});

	// The #wp iframe is nested inside #playground-viewport, so we need to
	// navigate through that iframe first
	const result = await website.page.evaluate(async () => {
		// First, find the playground viewport iframe
		const viewportIframe = document.querySelector<HTMLIFrameElement>(
			'#playground-viewport, .playground-viewport'
		);
		if (
			!viewportIframe ||
			!viewportIframe.contentWindow ||
			!viewportIframe.contentDocument
		) {
			throw new Error('Playground viewport iframe is not ready');
		}

		// Then find the #wp iframe inside the viewport
		const wpIframe =
			viewportIframe.contentDocument.querySelector<HTMLIFrameElement>(
				'#wp'
			);
		if (!wpIframe || !wpIframe.contentWindow || !wpIframe.contentDocument) {
			throw new Error('WordPress iframe is not ready');
		}

		// Check if the parent (WordPress) iframe is controlled
		const wpHasController =
			!!wpIframe.contentWindow?.navigator?.serviceWorker?.controller;
		console.log('WordPress iframe has controller:', wpHasController);

		const wpDoc = wpIframe.contentDocument;
		const child = wpDoc.createElement('iframe');
		console.log('Created child iframe, src:', child.src);

		wpDoc.body.appendChild(child);
		console.log('Appended child iframe, src:', child.src);

		// Wait for the iframe to get the data-controlled attribute (set by iframes-trap.js)
		const start = performance.now();
		while (performance.now() - start < 10000) {
			const controlled = child.getAttribute('data-controlled');
			if (controlled === '1') {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		console.log('Child iframe src:', child.src);
		console.log('Child iframe data-controlled:', child.getAttribute('data-controlled'));

		// Wait for the iframe content to load and for the SW to claim it
		// The navigation + SW claim can take a moment
		let hasController = false;
		let swError = null;
		const waitStart = performance.now();
		while (performance.now() - waitStart < 10000) {
			try {
				hasController =
					!!child.contentWindow?.navigator?.serviceWorker?.controller;
				if (hasController) {
					console.log(
						'Child SW controller:',
						child.contentWindow?.navigator?.serviceWorker?.controller
					);
					break;
				}
			} catch (e: unknown) {
				swError = e instanceof Error ? e.message : String(e);
			}
			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		// Always log the iframe content for debugging
		const iframeContent =
			child.contentDocument?.documentElement?.outerHTML?.substring(0, 500);
		console.log('Child iframe content:', iframeContent);

		if (!hasController) {
			console.log('Child SW controller still null after waiting');
		}

		return {
			controlled: child.getAttribute('data-controlled'),
			hasController,
			wpHasController,
			src: child.src,
			swError,
			iframeContent,
		};
	});

	console.log('Test result:', result);
	expect(result.controlled).toBe('1');
	expect(result.hasController).toBeTruthy();
});
