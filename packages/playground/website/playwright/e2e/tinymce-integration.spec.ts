import { expect, test } from '../playground-fixtures.ts';
import path from 'path';

/**
 * Integration tests for TinyMCE in WordPress Playground with Classic Editor.
 * These tests verify the real-world functionality that depends on iframes being
 * SW-controlled: typing in the editor and uploading media.
 */

test.describe('TinyMCE Classic Editor Integration', () => {
	test.setTimeout(120000); // 2 minutes for the full flow

	test('can type in TinyMCE editor and upload media image', async ({
		website,
		page,
	}) => {
		// Navigate to WordPress with classic editor plugin
		// Use networking to install the plugin from wordpress.org
		const blueprint = {
			preferredVersions: { php: '8.0', wp: 'latest' },
			features: { networking: true },
			steps: [
				{ step: 'login', username: 'admin', password: 'password' },
				{
					step: 'installPlugin',
					pluginData: { resource: 'wordpress.org/plugins', slug: 'classic-editor' },
					options: { activate: true },
				},
			],
		};
		await website.goto(`/#${JSON.stringify(blueprint)}`);

		const wpFrame = website.wordpress();

		// Navigate to create a new post
		await wpFrame.locator('a[href*="post-new.php"]').first().click();

		// Wait for the page to load and TinyMCE to initialize
		await wpFrame.locator('#title').waitFor({ state: 'visible', timeout: 30000 });

		// Enter a post title
		const postTitle = 'Test Post with TinyMCE ' + Date.now();
		await wpFrame.locator('#title').fill(postTitle);

		// Wait for TinyMCE editor iframe to appear
		// TinyMCE creates an iframe with id like "content_ifr"
		const tinyMceIframe = wpFrame.frameLocator('iframe#content_ifr');
		await wpFrame
			.locator('iframe#content_ifr')
			.waitFor({ state: 'attached', timeout: 30000 });

		// Give TinyMCE a moment to fully initialize
		await page.waitForTimeout(2000);

		// Click inside the TinyMCE editor body to focus it
		const editorBody = tinyMceIframe.locator('body#tinymce');
		await editorBody.waitFor({ state: 'visible', timeout: 10000 });
		await editorBody.click();

		// Type some content in TinyMCE
		const testContent = 'Hello from Playwright! This is a test of TinyMCE typing.';
		await editorBody.pressSequentially(testContent, { delay: 50 });

		// Verify the content was typed
		const editorContent = await editorBody.textContent();
		expect(editorContent).toContain(testContent);

		console.log('Successfully typed in TinyMCE editor');

		// Now test media upload
		// Click the "Add Media" button
		await wpFrame.locator('#insert-media-button').click();

		// Wait for the media modal to appear
		await wpFrame
			.locator('.media-modal')
			.waitFor({ state: 'visible', timeout: 10000 });

		// Click "Upload files" tab
		await wpFrame.locator('.media-menu-item').filter({ hasText: 'Upload files' }).click();

		// Get the file input (it's hidden but we can interact with it)
		const fileInput = wpFrame.locator('input[type="file"].moxie-shim-html5');

		// Prepare the test image path
		const testImagePath = path.resolve(
			__dirname,
			'../../public/test-fixtures/test-image.png'
		);

		// Upload the test image
		await fileInput.setInputFiles(testImagePath);

		// Wait for the upload to complete - the attachment should appear in the library
		// Wait for the attachment to be selected (has checkmark)
		await wpFrame
			.locator('.attachment.selected, .attachment.save-ready')
			.waitFor({ state: 'visible', timeout: 30000 });

		console.log('Image uploaded successfully');

		// Click "Insert into post" button
		await wpFrame.locator('.media-button-insert').click();

		// Wait for the modal to close
		await wpFrame
			.locator('.media-modal')
			.waitFor({ state: 'hidden', timeout: 10000 });

		// Verify the image was inserted into TinyMCE
		// Give it a moment for the insertion
		await page.waitForTimeout(1000);

		// Check that an img tag exists in the editor
		const imgInEditor = tinyMceIframe.locator('img');
		await imgInEditor.waitFor({ state: 'visible', timeout: 10000 });

		const imgSrc = await imgInEditor.getAttribute('src');
		expect(imgSrc).toBeTruthy();
		expect(imgSrc).toContain('test-image');

		console.log('Image inserted into editor with src:', imgSrc);

		// Optionally, verify the image actually loaded (not broken)
		const imgLoaded = await tinyMceIframe.locator('img').evaluate((img: HTMLImageElement) => {
			return img.complete && img.naturalWidth > 0;
		});
		expect(imgLoaded).toBe(true);

		console.log('TinyMCE integration test passed: typing and media upload both work!');
	});

	test('TinyMCE editor iframe is SW-controlled', async ({ website, page }) => {
		// This test specifically verifies the iframe control mechanism
		const blueprint = {
			preferredVersions: { php: '8.0', wp: 'latest' },
			features: { networking: true },
			steps: [
				{ step: 'login', username: 'admin', password: 'password' },
				{
					step: 'installPlugin',
					pluginData: { resource: 'wordpress.org/plugins', slug: 'classic-editor' },
					options: { activate: true },
				},
			],
		};
		await website.goto(`/#${JSON.stringify(blueprint)}`);

		const wpFrame = website.wordpress();

		// Navigate to create a new post
		await wpFrame.locator('a[href*="post-new.php"]').first().click();

		// Wait for TinyMCE to initialize
		await wpFrame
			.locator('iframe#content_ifr')
			.waitFor({ state: 'attached', timeout: 30000 });

		// Give TinyMCE time to fully initialize
		await page.waitForTimeout(2000);

		// Check if the TinyMCE iframe is SW-controlled
		const result = await page.evaluate(async () => {
			// Navigate through the iframe hierarchy
			const viewportIframe = document.querySelector<HTMLIFrameElement>(
				'#playground-viewport, .playground-viewport'
			);
			if (!viewportIframe?.contentDocument) {
				return { error: 'No viewport iframe' };
			}

			const wpIframe =
				viewportIframe.contentDocument.querySelector<HTMLIFrameElement>('#wp');
			if (!wpIframe?.contentDocument) {
				return { error: 'No WP iframe' };
			}

			// Find TinyMCE iframe
			const tinyIframe =
				wpIframe.contentDocument.querySelector<HTMLIFrameElement>(
					'iframe#content_ifr'
				);
			if (!tinyIframe) {
				return { error: 'No TinyMCE iframe found' };
			}

			// Get the actual controlled iframe (may be delegated to ancestor)
			const actualIframe =
				(tinyIframe as any).__controlledIframe || tinyIframe;

			// Check SW controller
			let hasController = false;
			let iframeLocation = '';
			try {
				hasController =
					!!actualIframe.contentWindow?.navigator?.serviceWorker?.controller;
				iframeLocation = actualIframe.contentWindow?.location?.href || 'unknown';
			} catch (e) {
				iframeLocation = 'cross-origin-error';
			}

			// Check if the body is contenteditable
			let isContentEditable = false;
			try {
				isContentEditable =
					actualIframe.contentDocument?.body?.isContentEditable || false;
			} catch (e) {
				// Cross-origin
			}

			return {
				dataControlled: tinyIframe.getAttribute('data-controlled'),
				dataControlledBy: tinyIframe.getAttribute('data-controlled-by'),
				hasControlledRef: !!(tinyIframe as any).__controlledIframe,
				hasController,
				iframeLocation,
				isContentEditable,
			};
		});

		console.log('TinyMCE SW control result:', JSON.stringify(result, null, 2));

		expect(result.error).toBeUndefined();
		expect(result.dataControlled).toBe('1');
		expect(result.hasController).toBe(true);
		expect(result.isContentEditable).toBe(true);
	});

	test('images load correctly in TinyMCE editor', async ({ website, page }) => {
		// This test verifies that images can be loaded inside the TinyMCE iframe
		// which requires the iframe to be SW-controlled
		const blueprint = {
			preferredVersions: { php: '8.0', wp: 'latest' },
			features: { networking: true },
			steps: [
				{ step: 'login', username: 'admin', password: 'password' },
				{
					step: 'installPlugin',
					pluginData: { resource: 'wordpress.org/plugins', slug: 'classic-editor' },
					options: { activate: true },
				},
			],
		};
		await website.goto(`/#${JSON.stringify(blueprint)}`);

		const wpFrame = website.wordpress();

		// Navigate to create a new post
		await wpFrame.locator('a[href*="post-new.php"]').first().click();

		// Wait for TinyMCE to initialize
		await wpFrame
			.locator('iframe#content_ifr')
			.waitFor({ state: 'attached', timeout: 30000 });

		await page.waitForTimeout(2000);

		// Inject an image directly into TinyMCE and verify it loads
		const result = await page.evaluate(async () => {
			// Navigate to TinyMCE
			const viewportIframe = document.querySelector<HTMLIFrameElement>(
				'#playground-viewport, .playground-viewport'
			);
			if (!viewportIframe?.contentDocument) {
				return { error: 'No viewport iframe' };
			}

			const wpIframe =
				viewportIframe.contentDocument.querySelector<HTMLIFrameElement>('#wp');
			if (!wpIframe?.contentDocument) {
				return { error: 'No WP iframe' };
			}

			const tinyIframe =
				wpIframe.contentDocument.querySelector<HTMLIFrameElement>(
					'iframe#content_ifr'
				);
			if (!tinyIframe) {
				return { error: 'No TinyMCE iframe' };
			}

			// Get the actual iframe (may be controlled version)
			const actualIframe =
				(tinyIframe as any).__controlledIframe || tinyIframe;

			const tinyDoc = actualIframe.contentDocument;
			if (!tinyDoc?.body) {
				return { error: 'Cannot access TinyMCE body' };
			}

			// Create and inject an image
			const img = tinyDoc.createElement('img');
			// Use a WordPress core image that exists in the virtual filesystem
			img.src = '/wp-includes/images/blank.gif';
			img.id = 'test-injected-image';
			tinyDoc.body.appendChild(img);

			// Wait for image to load
			const loadResult = await new Promise<{
				loaded: boolean;
				src: string;
				naturalWidth: number;
			}>((resolve) => {
				const timeout = setTimeout(() => {
					resolve({
						loaded: false,
						src: img.src,
						naturalWidth: img.naturalWidth,
					});
				}, 5000);

				if (img.complete && img.naturalWidth > 0) {
					clearTimeout(timeout);
					resolve({
						loaded: true,
						src: img.src,
						naturalWidth: img.naturalWidth,
					});
					return;
				}

				img.onload = () => {
					clearTimeout(timeout);
					resolve({
						loaded: true,
						src: img.src,
						naturalWidth: img.naturalWidth,
					});
				};

				img.onerror = () => {
					clearTimeout(timeout);
					resolve({
						loaded: false,
						src: img.src,
						naturalWidth: 0,
					});
				};
			});

			return {
				...loadResult,
				hasController:
					!!actualIframe.contentWindow?.navigator?.serviceWorker?.controller,
			};
		});

		console.log('Image load result:', JSON.stringify(result, null, 2));

		expect(result.error).toBeUndefined();
		expect(result.hasController).toBe(true);
		expect(result.loaded).toBe(true);
		expect(result.naturalWidth).toBeGreaterThan(0);
	});
});
