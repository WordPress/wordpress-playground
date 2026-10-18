import { test, expect } from '../../playground-fixtures';

/**
 * `?experimental=kandelo` must swap the remote iframe entry from the
 * classic `/remote.html` to the kernel-mode
 * `/remote-posix-kernel.html` (see `website/src/lib/config.ts`).
 *
 * Note both assertions run against the kernel dev config, where the
 * remote dev server also aliases `/remote.html` to the kernel entry —
 * so the param-less test asserts URL selection, not runtime choice.
 */

const viewportSelector =
	'#playground-viewport:visible,.playground-viewport:visible';

test('?experimental=kandelo selects the kernel-mode remote entry', async ({
	website,
	page,
	wordpress,
}) => {
	await website.goto('./?experimental=kandelo');
	const iframeSrc = await page.locator(viewportSelector).getAttribute('src');
	expect(new URL(iframeSrc!, page.url()).pathname).toBe(
		'/remote-posix-kernel.html'
	);
	// A rendered WordPress proves the boot got past the client's
	// `assertLikelyCompatibleRemoteOrigin`, which must accept the
	// kernel-mode pathname.
	await expect(wordpress.locator('body')).toBeVisible();
});

test('without the param the classic remote entry URL is used', async ({
	website,
	page,
}) => {
	await website.goto('./');
	const iframeSrc = await page.locator(viewportSelector).getAttribute('src');
	expect(new URL(iframeSrc!, page.url()).pathname).toBe('/remote.html');
});
