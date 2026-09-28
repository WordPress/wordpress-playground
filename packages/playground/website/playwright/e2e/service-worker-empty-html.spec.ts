import { test, expect } from '../playground-fixtures';

/**
 * Tests for the /wp-includes/empty.html document the service worker
 * synthesizes for the block editor's controlled iframe.
 *
 * WordPress 6.3 loads the editor canvas from a blob: URL. The service worker
 * patches block-editor.js so the canvas iframe navigates to
 * /wp-includes/empty.html instead (inheriting the service worker) and renders
 * the blob's content there. The URL fragment is the only channel available to
 * tell empty.html what to render.
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
});
