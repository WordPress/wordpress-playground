import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

/**
 * Tests for the Classic Editor plugin with TinyMCE.
 *
 * These tests verify that iframes created by TinyMCE (which use about:blank)
 * can still load resources through the service worker via the resource proxy.
 *
 * Related issue: Iframes with about:blank, srcdoc, data:, or blob: URLs are
 * NOT controlled by the parent page's service worker, causing CSS and other
 * resources to fail loading. The iframes-trap.js resource proxy fixes this.
 */

const classicEditorBlueprint: Blueprint = {
	landingPage: '/wp-admin/post-new.php',
	login: true,
	steps: [
		{
			step: 'installPlugin',
			pluginData: {
				resource: 'wordpress.org/plugins',
				slug: 'classic-editor',
			},
			options: { activate: true },
		},
	],
};

test.describe('Classic Editor (TinyMCE)', () => {
	test('should load TinyMCE editor with proper styling', async ({
		website,
		wordpress,
	}) => {
		await website.goto(`/#${JSON.stringify(classicEditorBlueprint)}`);

		// Wait for TinyMCE to initialize - the editor iframe should be present
		const tinymceIframe = wordpress.frameLocator('#content_ifr');
		await expect(tinymceIframe.locator('body')).toBeVisible();

		// The TinyMCE body should have proper styling (not unstyled)
		// When CSS fails to load, the body would have no contenteditable styling
		await expect(tinymceIframe.locator('body')).toHaveAttribute(
			'contenteditable',
			'true'
		);

		// Verify the toolbar is visible (indicates TinyMCE JS loaded correctly)
		await expect(wordpress.locator('.wp-editor-tabs')).toBeVisible();
	});

	test('should allow typing in TinyMCE editor', async ({
		website,
		wordpress,
	}) => {
		await website.goto(`/#${JSON.stringify(classicEditorBlueprint)}`);

		// Wait for TinyMCE to initialize
		const tinymceIframe = wordpress.frameLocator('#content_ifr');
		const editorBody = tinymceIframe.locator('body');
		await expect(editorBody).toBeVisible();

		// Click on the editor to focus it
		await editorBody.click();

		// Type some text
		const testText = 'Hello from Playwright test! Testing TinyMCE typing.';
		await editorBody.pressSequentially(testText, { delay: 10 });

		// Verify the text was entered
		await expect(editorBody).toContainText(testText);
	});

	test('should preserve text after switching between Visual and Text tabs', async ({
		website,
		wordpress,
	}) => {
		await website.goto(`/#${JSON.stringify(classicEditorBlueprint)}`);

		// Wait for TinyMCE to initialize
		const tinymceIframe = wordpress.frameLocator('#content_ifr');
		const editorBody = tinymceIframe.locator('body');
		await expect(editorBody).toBeVisible();

		// Type some text in Visual mode
		await editorBody.click();
		const testText = 'Test content for tab switching';
		await editorBody.pressSequentially(testText, { delay: 10 });

		// Switch to Text (HTML) tab
		await wordpress.locator('#content-html').click();

		// Wait a moment for TinyMCE to sync content to textarea
		// TinyMCE syncs content asynchronously when switching tabs
		await wordpress.locator('#content').waitFor({ state: 'visible' });

		// Verify the text is in the textarea (use inputValue for textarea elements)
		const textarea = wordpress.locator('#content');
		await expect(textarea).toHaveValue(new RegExp(testText));

		// Switch back to Visual tab
		await wordpress.locator('#content-tmce').click();

		// Verify text is still there in the visual editor
		await expect(tinymceIframe.locator('body')).toContainText(testText);
	});

	test('should open Add Media dialog', async ({ website, wordpress }) => {
		await website.goto(`/#${JSON.stringify(classicEditorBlueprint)}`);

		// Wait for TinyMCE to initialize
		const tinymceIframe = wordpress.frameLocator('#content_ifr');
		await expect(tinymceIframe.locator('body')).toBeVisible();

		// Click the Add Media button
		await wordpress.locator('#insert-media-button').click();

		// The media modal should open
		await expect(wordpress.locator('.media-modal')).toBeVisible();

		// Verify the Upload Files tab is available
		await expect(
			wordpress.locator('.media-menu-item').filter({ hasText: 'Upload files' })
		).toBeVisible();
	});

	test('should upload an image via Add Media', async ({
		website,
		wordpress,
		page,
	}) => {
		await website.goto(`/#${JSON.stringify(classicEditorBlueprint)}`);

		// Wait for TinyMCE to initialize
		const tinymceIframe = wordpress.frameLocator('#content_ifr');
		await expect(tinymceIframe.locator('body')).toBeVisible();

		// First, create a test image file in WordPress using the playground API
		await page.waitForFunction(() => Boolean((window as any).playground));
		await page.evaluate(async () => {
			const playground = (window as any).playground;
			// Create a simple 1x1 red PNG image (base64 encoded)
			const pngBase64 =
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
			const binaryString = atob(pngBase64);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			await playground.writeFile('/wordpress/wp-content/test-image.png', bytes);
		});

		// Click the Add Media button
		await wordpress.locator('#insert-media-button').click();
		await expect(wordpress.locator('.media-modal')).toBeVisible();

		// Switch to Media Library tab
		const mediaLibraryTab = wordpress
			.locator('.media-menu-item')
			.filter({ hasText: 'Media Library' });
		await mediaLibraryTab.click();

		// Click "Upload files" tab
		const uploadTab = wordpress
			.locator('.media-menu-item')
			.filter({ hasText: 'Upload files' });
		await uploadTab.click();

		// Wait for the upload UI to be ready
		await expect(wordpress.locator('.upload-ui')).toBeVisible();

		// Set up file chooser listener and trigger file input
		const fileChooserPromise = page.waitForEvent('filechooser');

		// Click the "Select Files" button to trigger the file chooser
		await wordpress.locator('.browser, input[type="file"]').first().click();

		const fileChooser = await fileChooserPromise;

		// Create a simple test PNG file
		const pngBase64 =
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
		const buffer = Buffer.from(pngBase64, 'base64');

		await fileChooser.setFiles({
			name: 'test-upload.png',
			mimeType: 'image/png',
			buffer,
		});

		// Wait for the upload to complete and the image to appear in the library
		await expect(
			wordpress.locator('.attachment, .thumbnail').first()
		).toBeVisible({ timeout: 30000 });
	});

	test('should insert uploaded image into editor', async ({
		website,
		wordpress,
		page,
	}) => {
		await website.goto(`/#${JSON.stringify(classicEditorBlueprint)}`);

		// Wait for TinyMCE to initialize
		const tinymceIframe = wordpress.frameLocator('#content_ifr');
		await expect(tinymceIframe.locator('body')).toBeVisible();

		// Click the Add Media button
		await wordpress.locator('#insert-media-button').click();
		await expect(wordpress.locator('.media-modal')).toBeVisible();

		// Upload a file
		const uploadTab = wordpress
			.locator('.media-menu-item')
			.filter({ hasText: 'Upload files' });
		await uploadTab.click();

		const fileChooserPromise = page.waitForEvent('filechooser');
		await wordpress.locator('.browser, input[type="file"]').first().click();
		const fileChooser = await fileChooserPromise;

		const pngBase64 =
			'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGNzYAAIoaB/lnPAJMAAAAAElFTkSuQmCC';
		const buffer = Buffer.from(pngBase64, 'base64');

		await fileChooser.setFiles({
			name: 'test-image-insert.png',
			mimeType: 'image/png',
			buffer,
		});

		// Wait for upload to complete
		await expect(
			wordpress.locator('.attachment.selected, .attachment.save-ready').first()
		).toBeVisible({ timeout: 30000 });

		// Click "Insert into post" button
		await wordpress.locator('.media-button-insert').click();

		// Verify the image was inserted into the editor
		await expect(tinymceIframe.locator('img')).toBeVisible({ timeout: 10000 });
	});

	test('should apply bold formatting to text', async ({
		website,
		wordpress,
	}) => {
		await website.goto(`/#${JSON.stringify(classicEditorBlueprint)}`);

		// Wait for TinyMCE to initialize
		const tinymceIframe = wordpress.frameLocator('#content_ifr');
		const editorBody = tinymceIframe.locator('body');
		await expect(editorBody).toBeVisible();

		// Type some text
		await editorBody.click();
		await editorBody.pressSequentially('This is bold text', { delay: 10 });

		// Select all text with Ctrl+A
		await editorBody.press('Control+a');

		// Click the Bold button in the toolbar
		await wordpress
			.locator('.mce-i-bold, button[aria-label="Bold"]')
			.first()
			.click();

		// Verify the text is now bold (wrapped in <strong> or <b>)
		const boldText = tinymceIframe.locator('strong, b');
		await expect(boldText).toContainText('This is bold text');
	});
});
