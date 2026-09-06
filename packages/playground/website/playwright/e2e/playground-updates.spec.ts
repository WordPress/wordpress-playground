import { test, expect } from '../playground-fixtures';

test('reads updates without leaving a custom Blueprint site', async ({
	website,
	wordpress,
}) => {
	const page = website.page;
	const articleUrl =
		'https://make.wordpress.org/playground/2026/09/05/new-feature/';
	await page.route(
		'https://make.wordpress.org/playground/wp-json/wp/v2/posts?*',
		(route) =>
			route.fulfill({
				json: [
					{
						id: 740,
						date_gmt: '2026-09-05T10:59:22',
						link: articleUrl,
						title: { rendered: 'A new Playground feature' },
					},
				],
			})
	);
	await website.goto(
		'./?storage=temp#' +
			encodeURIComponent(
				JSON.stringify({
					landingPage: '/wp-admin/plugins.php',
					login: true,
				})
			)
	);
	await expect(
		wordpress.getByRole('heading', { name: 'Plugins', exact: true })
	).toBeVisible();
	const pane = page.getByRole('dialog', {
		name: 'What’s new in Playground pane',
	});
	await expect(pane).not.toBeVisible();
	await page
		.getByRole('button', { name: 'What’s new — unread updates' })
		.click();
	await expect(pane).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'What’s new', exact: true })
	).toHaveAttribute('aria-expanded', 'true');

	// Route the article too: this checks the new-tab behavior without depending
	// on the blog being available or moving the running WordPress site.
	await page
		.context()
		.route(articleUrl, (route) =>
			route.fulfill({ body: '<h1>A new Playground feature</h1>' })
		);
	const popupPromise = page.waitForEvent('popup');
	await pane.getByRole('link', { name: /A new Playground feature/ }).click();
	const popup = await popupPromise;
	await expect(popup).toHaveURL(articleUrl);
	await popup.close();
	await page.keyboard.press('Escape');
	await expect(pane).not.toBeVisible();
	await expect(
		wordpress.getByRole('heading', { name: 'Plugins', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'What’s new', exact: true })
	).toBeFocused();

	await page.reload();
	await website.waitForNestedIframes();
	await expect(
		page.getByRole('button', { name: 'What’s new', exact: true })
	).toBeVisible();
	await expect(pane).not.toBeVisible();
});
