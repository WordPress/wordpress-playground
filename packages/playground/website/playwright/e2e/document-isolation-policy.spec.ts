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
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/post-new.php',
		login: true,
	};

	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// First, wait for WordPress admin to fully load (admin menu is a reliable indicator)
	await expect(wordpress.locator('#adminmenu')).toBeVisible({
		timeout: 60000,
	});

	// The editor should load and show the title field
	await expect(
		wordpress.getByRole('textbox', { name: 'Add title' })
	).toBeVisible({ timeout: 60000 });
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

	// First, wait for WordPress admin to fully load (admin menu is a reliable indicator)
	await expect(wordpress.locator('#adminmenu')).toBeVisible({
		timeout: 120000,
	});

	// The editor should load and show the title field even with COEP/COOP
	// headers that would normally break the iframe
	await expect(
		wordpress.getByRole('textbox', { name: 'Add title' })
	).toBeVisible({ timeout: 120000 });
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

	// First, wait for WordPress admin to fully load (admin menu is a reliable indicator)
	await expect(wordpress.locator('#adminmenu')).toBeVisible({
		timeout: 120000,
	});

	// Wait for the editor to load
	await expect(
		wordpress.getByRole('textbox', { name: 'Add title' })
	).toBeVisible({ timeout: 120000 });

	// Navigate to a different page via WordPress admin menu
	await wordpress.getByRole('link', { name: 'Dashboard' }).first().click();

	// Wait for Dashboard to load
	await expect(wordpress.locator('body')).toContainText('Dashboard', {
		timeout: 30000,
	});

	// The URL should reflect the navigation (even with Document-Isolation-Policy
	// which prevents direct access to iframe.contentWindow.location.href)
	// The MU plugin posts a message with the URL which updates the address bar
	const addressBar = page
		.locator('.address-bar-url input, input[type="text"]')
		.first();
	if (await addressBar.isVisible()) {
		await expect(addressBar).toHaveValue(/\/wp-admin\/?$/, {
			timeout: 10000,
		});
	}
});
