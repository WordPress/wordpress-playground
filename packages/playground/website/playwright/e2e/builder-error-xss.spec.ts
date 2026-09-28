import { test, expect } from '../playground-fixtures';

/**
 * Tests for the error document the Blueprint Builder renders when a Blueprint
 * fails schema validation.
 *
 * The Builder runs the Blueprint in the URL fragment on load, and schema errors
 * quote the part of it that failed, so the message is untrusted text. It
 * reaches the page through an iframe's `srcdoc` on the Playground origin, where
 * anything treated as markup would run with access to the Builder window and
 * the origin's OPFS-persisted sites. The message must therefore reach the
 * document escaped, which is what the first test asserts; the second pins the
 * iframe's `sandbox` so the second line of defense cannot be dropped silently.
 */

test('Blueprint Builder must not execute markup from a schema error', async ({
	page,
}) => {
	const payload = `<img src=x onerror="parent.document.title='xss-executed'">`;
	const blueprint = JSON.stringify({ version: 2, [payload]: 1 });

	await page.goto(`./builder/builder.html#${blueprint}`);

	const errorFrame = page.locator('#error-output');
	// The error must actually be rendered, or the test proves nothing.
	await expect(errorFrame).toHaveAttribute(
		'srcdoc',
		/must NOT have additional properties/,
		{ timeout: 60000 }
	);

	// Let the payload run before asserting that it did not.
	await page.waitForTimeout(1000);

	expect(await page.title()).not.toBe('xss-executed');
	expect(await errorFrame.getAttribute('srcdoc')).not.toContain('<img');
});

test('Blueprint Builder error iframe keeps its sandbox', async ({ page }) => {
	await page.goto('./builder/builder.html');

	const errorFrame = page.locator('#error-output');
	await expect(errorFrame).toHaveAttribute('sandbox', '');
});
