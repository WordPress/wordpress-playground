import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

/**
 * Tests for the /wp-includes/empty.html document the service worker
 * synthesizes for the block editor's controlled iframe.
 *
 * WordPress 6.3 loads the editor canvas from a blob: URL. The service worker
 * patches block-editor.js so the canvas iframe navigates to
 * /wp-includes/empty.html instead (inheriting the service worker) and renders
 * the blob's content there. The URL fragment is the only channel available to
 * tell empty.html what to render. A query parameter tells it whether to send
 * Document-Isolation-Policy, so the preview matches the editor's isolation.
 *
 * Accepting arbitrary HTML through that fragment is a DOM XSS on the
 * Playground origin: a crafted link executes script for any visitor whose
 * browser has the Playground service worker registered. empty.html must only
 * honor a same-origin blob: URL in the fragment — a capability that can only
 * be minted by script already running on the Playground origin.
 */

test('empty.html must not render HTML passed in the URL fragment', async ({
	website,
	page,
}) => {
	// Boot Playground first: empty.html only exists as a service worker
	// response, and the attack targets visitors who already have the
	// service worker registered.
	await website.goto('./?storage=temp');

	// Resolve the attack URL against the remote iframe's origin — that is
	// the origin the service worker controls.
	const remoteSrc = await page
		.locator('#playground-viewport:visible,.playground-viewport:visible')
		.first()
		.getAttribute('src');
	const payload =
		'<div id="xss-injected"></div>' +
		'<img src="x" onerror="document.title = \'xss-executed\'">';
	const attackUrl = new URL(
		'/scope:xss-poc/wp-includes/empty.html#' + encodeURIComponent(payload),
		new URL(remoteSrc!, page.url())
	);

	await page.goto(attackUrl.href);
	// Let the payload run before asserting that it did not.
	await page.waitForTimeout(1000);

	await expect(page.locator('#xss-injected')).toHaveCount(0);
	expect(await page.title()).not.toBe('xss-executed');
});

test('WordPress 6.3 site editor renders through the empty.html iframe', async ({
	website,
	wordpress,
}) => {
	await website.goto(
		'./?storage=temp&wp=6.3&url=/wp-admin/site-editor.php%3Fcanvas%3Dedit'
	);

	// The service worker rewrites the canvas iframe's blob: src to
	// /wp-includes/empty.html. Confirm the patched mechanism engaged rather
	// than silently falling through to an unpatched iframe.
	const canvas = wordpress.locator('iframe[name="editor-canvas"]');
	await expect(canvas).toBeVisible({ timeout: 120000 });
	expect(await canvas.getAttribute('src')).toContain(
		'/wp-includes/empty.html'
	);

	// The site content only renders when empty.html actually wrote the
	// blob document.
	const canvasFrame = wordpress.frameLocator('iframe[name="editor-canvas"]');
	await expect(canvasFrame.locator('.wp-site-blocks')).toBeVisible({
		timeout: 120000,
	});
	// The canvas loads its styles, scripts, and fonts through the service worker.
	expect(
		await canvasFrame
			.locator('html')
			.evaluate(() => !!navigator.serviceWorker.controller)
	).toBe(true);
});

test('Site editor preview renders after the service worker restarts', async ({
	website,
	wordpress,
	page,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		'Document-Isolation-Policy and stopping service workers through CDP are Chromium-only'
	);

	const blueprint: Blueprint = {
		landingPage: '/wp-admin/site-editor.php',
		preferredVersions: { wp: '7.1' },
		login: true,
		steps: [
			{
				// WordPress sends Document-Isolation-Policy on editor screens only
				// when client-side media processing is enabled. By default, that
				// requires HTTPS or localhost.
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/client-side-media.php',
				data: "<?php add_filter( 'wp_client_side_media_processing_enabled', '__return_true' );",
			},
		],
	};
	await website.goto(`./?storage=temp#${JSON.stringify(blueprint)}`);

	const canvasFrame = wordpress.frameLocator('iframe[name="editor-canvas"]');
	await expect(canvasFrame.locator('.wp-site-blocks')).toBeVisible({
		timeout: 120000,
	});
	// The preview only breaks when the editor is isolated, so make sure it is.
	expect(
		await wordpress
			.locator('html')
			.evaluate(() => window.crossOriginIsolated)
	).toBe(true);

	// Browsers stop idle service workers, which drops their in-memory state.
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('ServiceWorker.enable');
	await cdp.send('ServiceWorker.stopAllWorkers');

	// Opening Styles replaces the preview document. Mark the current one so
	// the assertion below cannot pass before the new document renders.
	await canvasFrame
		.locator('html')
		.evaluate((html) => html.setAttribute('data-e2e-previous', ''));
	await wordpress
		.getByRole('button', { name: 'Styles', exact: true })
		.click();
	await expect(
		canvasFrame.locator('html:not([data-e2e-previous]) .wp-site-blocks')
	).toBeVisible();
});
