import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

/**
 * Tests for Document-Isolation-Policy header rewriting.
 *
 * When Gutenberg's client-side media processing experiment is enabled, it sets
 * Cross-Origin-Embedder-Policy (COEP) and Cross-Origin-Opener-Policy (COOP)
 * headers. These headers enable SharedArrayBuffer but break external embeds
 * and cause issues in Playground's iframe-based architecture.
 *
 * Playground rewrites these headers to Document-Isolation-Policy in browsers
 * that support it, which provides the same SharedArrayBuffer access without
 * the cross-origin restrictions.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/2954
 * @see https://developer.chrome.com/blog/document-isolation-policy
 */

test('Post editor should load without client-side media experiment', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'Document-Isolation-Policy is only supported in Chromium-based browsers'
	);

	const blueprint: Blueprint = {
		landingPage: '/wp-admin/post-new.php',
		login: true,
	};

	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// Wait for the block editor to fully load. We check for the editor header
	// which is always visible even when the editor is in fullscreen mode.
	await expect(
		wordpress.locator('.edit-post-header, .editor-header')
	).toBeVisible({
		timeout: 60000,
	});
});

test('Post editor should load with Gutenberg and client-side media experiment enabled', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'Document-Isolation-Policy is only supported in Chromium-based browsers'
	);

	const blueprint: Blueprint = {
		landingPage: '/wp-admin/post-new.php',
		plugins: ['gutenberg'],
		login: true,
		steps: [
			{
				step: 'runPHP',
				code: `<?php
					require '/wordpress/wp-load.php';
					update_option('gutenberg-experiments', array(
						'gutenberg-media-processing' => true,
						'gutenberg-new-posts-dashboard' => true,
						'gutenberg-quick-edit-dataviews' => true
					));
				`,
			},
		],
	};

	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// Wait for the block editor to fully load. The post editor should work even with
	// COEP/COOP headers that would normally break the iframe - Document-Isolation-Policy
	// rewrites them to avoid cross-origin isolation issues.
	await expect(
		wordpress.locator('.edit-post-header, .editor-header')
	).toBeVisible({
		timeout: 120000,
	});
});

test('Navigation URL should update in address bar with Document-Isolation-Policy', async ({
	website,
	wordpress,
	page,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'Document-Isolation-Policy is only supported in Chromium-based browsers'
	);

	const blueprint: Blueprint = {
		landingPage: '/wp-admin/post-new.php',
		plugins: ['gutenberg'],
		login: true,
		steps: [
			{
				step: 'runPHP',
				code: `<?php
					require '/wordpress/wp-load.php';
					update_option('gutenberg-experiments', array(
						'gutenberg-media-processing' => true
					));
				`,
			},
		],
	};

	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// Wait for the block editor to fully load
	await expect(
		wordpress.locator('.edit-post-header, .editor-header')
	).toBeVisible({
		timeout: 120000,
	});

	// Close the "Welcome to the editor" modal if it appears
	const welcomeModalCloseButton = wordpress.locator(
		'.components-modal__header button[aria-label="Close"]'
	);
	if (
		await welcomeModalCloseButton
			.isVisible({ timeout: 3000 })
			.catch(() => false)
	) {
		await welcomeModalCloseButton.click();
	}

	// Navigate to Dashboard by clicking the WordPress logo in the editor header
	// (the admin menu may be hidden when the editor is in fullscreen mode)
	const wpLogoLink = wordpress.locator(
		'a.edit-post-fullscreen-mode-close, a[aria-label="View Posts"]'
	);
	await wpLogoLink.first().click({ timeout: 30000 });

	// Wait for the next page to load - it could be the posts list or dashboard
	await expect(wordpress.locator('body')).toContainText(
		/(Dashboard|Posts|All Posts)/,
		{
			timeout: 30000,
		}
	);

	// The URL should reflect the navigation (even with Document-Isolation-Policy
	// which prevents direct access to iframe.contentWindow.location.href)
	// The MU plugin posts a message with the URL which updates the address bar
	const addressBar = page
		.locator('.address-bar-url input, input[type="text"]')
		.first();
	if (await addressBar.isVisible()) {
		// The URL should have changed from post-new.php to dashboard or posts list
		// Wait for the URL to NOT be post-new.php anymore
		await expect(addressBar).not.toHaveValue(/post-new\.php/, {
			timeout: 15000,
		});
	}
});
