import { test, expect } from './playground-fixtures';

test('the WordPress.org demo link clones Field Notes without a key', async ({
	page,
	baseURL,
	wordpress,
}) => {
	test.setTimeout(10 * 60_000);

	await page.goto('https://wordpress.org/reprint/', {
		waitUntil: 'domcontentloaded',
	});
	const link = page.getByRole('link', { name: /Open Playground/ });
	const destination = new URL((await link.getAttribute('href'))!, page.url());
	expect(destination.origin).toBe('https://playground.wordpress.net');
	const source = destination.searchParams.get('clone-site') ?? '';
	expect(source).toMatch(/^https:\/\/reprint-demo\.wordpress\.net\/?$/);

	// Preserve the public link's path and query when testing a candidate build.
	await page.goto(
		new URL(
			destination.pathname + destination.search + destination.hash,
			baseURL
		).href
	);
	const pane = page.getByRole('dialog', {
		name: 'Clone a WordPress site pane',
	});
	await expect(
		pane.getByRole('textbox', { name: 'Live site URL' })
	).toHaveValue(source);
	await pane.getByRole('button', { name: 'Clone site', exact: true }).click();

	const openSite = page.getByRole('button', {
		name: 'Open site',
		exact: true,
	});
	const failure = page.getByRole('dialog').getByRole('alert');
	// Report a transfer error promptly instead of waiting for the success button.
	await expect(openSite.or(failure)).toBeVisible({ timeout: 7 * 60_000 });
	await expect(failure).toHaveCount(0, { timeout: 1000 });
	await openSite.click();

	// Check that both the database content and an uploaded photo made it into the copy.
	await expect(
		wordpress.getByRole('heading', { name: 'A site worth copying.' })
	).toBeVisible();
	const photo = wordpress.getByRole('img', {
		name: 'A walker looking along a foggy forest trail.',
	});
	const sourceOrigin = new URL(source).origin;
	await expect
		.poll(() =>
			photo.evaluate((element: HTMLImageElement, remoteOrigin) => {
				const origin = window.location.origin;
				return (
					origin !== remoteOrigin &&
					element.naturalWidth > 0 &&
					new URL(element.currentSrc).origin === origin
				);
			}, sourceOrigin)
		)
		.toBe(true);
});
