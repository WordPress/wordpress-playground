import { expect, test } from '../playground-fixtures.ts';

/**
 * Test that TinyMCE editor iframe is SW-controlled and can load images.
 * This is the real-world scenario that was broken before the iframes-trap.js fix:
 * TinyMCE creates a srcdoc iframe for its editor, and images inside wouldn't load
 * because the iframe wasn't SW-controlled.
 */
test('TinyMCE editor iframe is SW-controlled and can load images', async ({
	website,
}) => {
	// Navigate to WordPress with the classic editor (use URL that enables it)
	await website.goto(
		'./#{"preferredVersions":{"php":"8.0","wp":"latest"},"features":{"networking":true},"steps":[{"step":"login","username":"admin","password":"password"},{"step":"installPlugin","pluginData":{"resource":"wordpress.org/plugins","slug":"classic-editor"},"options":{"activate":true}}]}'
	);
	await website.waitForNestedIframes();

	// Navigate to create a new post (classic editor) using a frame locator
	const wpFrame = website.wordpress();
	await wpFrame.locator('a[href*="post-new.php"]').first().click();

	// Wait for TinyMCE to initialize - it creates an iframe with id containing "ifr"
	// Use 'attached' state since TinyMCE may hide the iframe visually
	await wpFrame.locator('iframe[id*="ifr"]').waitFor({ state: 'attached', timeout: 30000 });

	// Check TinyMCE iframe is SW-controlled
	const result = await website.page.evaluate(async () => {
		// Navigate through the iframe hierarchy to find TinyMCE
		const viewportIframe = document.querySelector<HTMLIFrameElement>(
			'#playground-viewport, .playground-viewport'
		);
		if (!viewportIframe?.contentDocument) {
			return { error: 'No viewport iframe' };
		}

		const wpIframe =
			viewportIframe.contentDocument.querySelector<HTMLIFrameElement>(
				'#wp'
			);
		if (!wpIframe?.contentDocument) {
			return { error: 'No WP iframe' };
		}

		// Find TinyMCE iframe
		const tinyIframe =
			wpIframe.contentDocument.querySelector<HTMLIFrameElement>(
				'iframe[id*="ifr"]'
			);
		if (!tinyIframe) {
			return { error: 'No TinyMCE iframe found' };
		}

		// Wait for the iframe to be controlled
		await new Promise((r) => setTimeout(r, 2000));

		// Check if TinyMCE iframe is controlled
		const dataControlled = tinyIframe.getAttribute('data-controlled');
		const controlledBy = tinyIframe.getAttribute('data-controlled-by');

		// Access the actual controlled iframe (may be in parent document)
		let actualIframe = tinyIframe;
		if (tinyIframe.__controlledIframe) {
			actualIframe =
				tinyIframe.__controlledIframe as HTMLIFrameElement;
		}

		let hasController = false;
		let iframeLocation = '';
		try {
			hasController =
				!!actualIframe.contentWindow?.navigator?.serviceWorker
					?.controller;
			iframeLocation =
				actualIframe.contentWindow?.location?.href || 'unknown';
		} catch (e) {
			// Cross-origin
		}

		// Try to inject an image into TinyMCE and check if it loads
		let imageLoaded = false;
		let imageSrc = '';
		try {
			const tinyDoc = actualIframe.contentDocument;
			if (tinyDoc?.body) {
				const img = tinyDoc.createElement('img');
				// Use a WordPress core image that should be served by the SW
				img.src = '/wp-includes/images/blank.gif';
				imageSrc = img.src;
				tinyDoc.body.appendChild(img);

				// Wait for image to load
				await new Promise<void>((resolve) => {
					const timeout = setTimeout(() => resolve(), 3000);
					img.onload = () => {
						clearTimeout(timeout);
						imageLoaded = true;
						resolve();
					};
					img.onerror = () => {
						clearTimeout(timeout);
						resolve();
					};
					// Check if already loaded
					if (img.complete && img.naturalWidth > 0) {
						clearTimeout(timeout);
						imageLoaded = true;
						resolve();
					}
				});
			}
		} catch (e) {
			// Ignore errors accessing TinyMCE content
		}

		return {
			dataControlled,
			controlledBy,
			hasController,
			iframeLocation,
			imageLoaded,
			imageSrc,
			tinyIframeId: tinyIframe.id,
		};
	});

	console.log('TinyMCE test result:', JSON.stringify(result, null, 2));

	expect(result.error).toBeUndefined();
	expect(result.dataControlled).toBe('1');
	expect(result.hasController).toBe(true);
	// Image should load because the TinyMCE iframe is SW-controlled
	expect(result.imageLoaded).toBe(true);
});

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
