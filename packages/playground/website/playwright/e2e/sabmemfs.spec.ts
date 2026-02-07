import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

/**
 * Tests for the SharedArrayBuffer-backed Memory File System (SABMEMFS).
 *
 * When cross-origin isolation is available (via Document-Isolation-Policy
 * or COOP/COEP headers), Playground automatically mounts SABMEMFS at
 * /wordpress and /internal/shared. These tests verify that WordPress
 * boots and operates correctly on SABMEMFS.
 *
 * These tests only run in Chromium since Document-Isolation-Policy is
 * needed for cross-origin isolation in an iframe context.
 */

test('WordPress should boot and serve the front page with SABMEMFS', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'SABMEMFS requires cross-origin isolation via Document-Isolation-Policy (Chromium only)'
	);

	const blueprint: Blueprint = {
		landingPage: '/',
		login: true,
	};

	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// Verify the WordPress front page loaded successfully
	await expect(wordpress.locator('body')).not.toBeEmpty({
		timeout: 60000,
	});
});

test('Should be able to create and view a post with SABMEMFS', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'SABMEMFS requires cross-origin isolation via Document-Isolation-Policy (Chromium only)'
	);

	const postTitle = 'SABMEMFS Test Post ' + Date.now();

	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		login: true,
		steps: [
			{
				step: 'runPHP',
				code: `<?php
					require '/wordpress/wp-load.php';
					$post_id = wp_insert_post(array(
						'post_title'   => '${postTitle}',
						'post_content' => 'This post was created on SABMEMFS.',
						'post_status'  => 'publish',
						'post_type'    => 'post',
					));
					echo $post_id;
				`,
			},
		],
	};

	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// Verify wp-admin loaded
	await expect(wordpress.locator('body.wp-admin')).toBeVisible({
		timeout: 60000,
	});

	// Navigate to the front page and check the post is visible
	await wordpress
		.locator('#wp-admin-bar-site-name a')
		.first()
		.click();

	await expect(wordpress.locator('body')).toContainText(postTitle, {
		timeout: 30000,
	});
});

test('WordPress admin dashboard should load with SABMEMFS', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'SABMEMFS requires cross-origin isolation via Document-Isolation-Policy (Chromium only)'
	);

	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		login: true,
	};

	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// The dashboard should load without crashes
	await expect(
		wordpress.locator('#dashboard-widgets-wrap, .wrap h1')
	).toBeVisible({
		timeout: 60000,
	});
});
