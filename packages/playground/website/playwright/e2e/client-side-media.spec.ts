import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

/**
 * Tests for Gutenberg's client-side media processing in Playground.
 *
 * Client-side media processing needs SharedArrayBuffer (for wasm-vips
 * threading), which is only available when the document is cross-origin
 * isolated. Gutenberg's own feature detection short-circuits otherwise.
 *
 * On Chromium 137+, Gutenberg sends `Document-Isolation-Policy:
 * isolate-and-credentialless` on the editor admin screens (see Gutenberg
 * PR #75991, shipped in Gutenberg 22.6+). Playground's service worker
 * additionally injects DIP on the inner `empty.html` editor iframe so
 * parent/child DIP stay in parity.
 *
 * These tests validate that client-side media is re-enabled in Playground
 * (issue #3514) and that the editor frame actually ends up cross-origin
 * isolated with SharedArrayBuffer available. The existing
 * document-isolation-policy.spec.ts covers that the editor renders
 * successfully (which implicitly verifies parent/child DIP parity).
 *
 * Playwright's default `chromium_headless_shell` build does not honor
 * Document-Isolation-Policy, so these tests opt into `channel: 'chromium'`
 * (the full Chromium browser) via `test.use()`. Playwright's CI install
 * step already installs it via `playwright install chromium --with-deps`.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/3514
 * @see https://github.com/WordPress/wordpress-playground/issues/2954
 * @see https://github.com/WordPress/gutenberg/pull/75991
 * @see https://developer.chrome.com/blog/document-isolation-policy
 */

test.use({ channel: 'chromium' });

const clientSideMediaBlueprint: Blueprint = {
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

function skipNonChromium(browserName: string) {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'Document-Isolation-Policy and client-side media are only supported in Chromium-based browsers'
	);
}

test('Post editor should be cross-origin isolated with SharedArrayBuffer available', async ({
	website,
	wordpress,
	browserName,
}) => {
	skipNonChromium(browserName);

	await website.goto(`./#${JSON.stringify(clientSideMediaBlueprint)}`);

	// Wait for the block editor to fully load. The editor header is visible in both
	// fullscreen and non-fullscreen modes.
	await expect(
		wordpress.locator('.edit-post-header, .editor-header')
	).toBeVisible({
		timeout: 120000,
	});

	// The editor window should be cross-origin isolated, which is the required
	// precondition for SharedArrayBuffer and therefore for wasm-vips / client-side
	// media processing.
	const isCrossOriginIsolated = await wordpress
		.locator('html')
		.evaluate(() => window.crossOriginIsolated);
	expect(isCrossOriginIsolated).toBe(true);

	const sharedArrayBufferAvailable = await wordpress
		.locator('html')
		.evaluate(() => typeof SharedArrayBuffer !== 'undefined');
	expect(sharedArrayBufferAvailable).toBe(true);
});

test('Gutenberg should report client-side media processing as enabled', async ({
	website,
	wordpress,
	browserName,
}) => {
	skipNonChromium(browserName);

	await website.goto(`./#${JSON.stringify(clientSideMediaBlueprint)}`);

	await expect(
		wordpress.locator('.edit-post-header, .editor-header')
	).toBeVisible({
		timeout: 120000,
	});

	// Gutenberg sets this global when client-side media processing is enabled AND
	// cross-origin isolation is available server-side. If either is missing, the
	// flag will be undefined.
	// @see Gutenberg lib/media/load.php — gutenberg_set_client_side_media_processing_flag
	const clientSideMediaFlag = await wordpress
		.locator('html')
		.evaluate(
			() =>
				(window as unknown as Record<string, unknown>)
					.__clientSideMediaProcessing
		);
	expect(clientSideMediaFlag).toBe(true);
});
