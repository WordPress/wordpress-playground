import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

test('a preview keeps the same WordPress site after the original tab closes', async ({
	website,
	wordpress,
	page,
	context,
}) => {
	const blueprint: Blueprint = {
		steps: [
			{
				step: 'runPHP',
				code: `<?php
					require '/wordpress/wp-load.php';
					wp_insert_post(array(
						'post_title' => 'Shared across tabs',
						'post_status' => 'publish'
					));`,
			},
			{
				step: 'writeFile',
				path: '/wordpress/tab-counter.php',
				data: `<?php
					$path = '/wordpress/tab-counter.txt';
					$count = file_exists($path) ? (int) file_get_contents($path) : 0;
					file_put_contents($path, ++$count);
					if ($count === 1) {
						require '/wordpress/wp-load.php';
						wp_insert_post(array(
							'post_title' => 'Added with the preview open',
							'post_status' => 'publish'
						));
					}
					echo $count;`,
			},
		],
	};
	await website.goto('./?storage=temp#' + JSON.stringify(blueprint));
	const siteUrl = await wordpress
		.locator('body')
		.evaluate(() => window.location.href);
	const preview = await context.newPage();
	await preview.goto(new URL('./', siteUrl).href);
	await expect(
		preview.getByRole('heading', { name: 'Shared across tabs' }).first()
	).toBeVisible();
	expect(
		await wordpress.locator('body').evaluate(async () => {
			const response = await fetch('tab-counter.php');
			return await response.text();
		})
	).toBe('1');

	await page.close();
	await preview.reload();
	await expect(
		preview
			.getByRole('heading', { name: 'Added with the preview open' })
			.first()
	).toBeVisible();
	for (const count of ['2', '3']) {
		expect(
			await preview.evaluate(async () => {
				const response = await fetch('tab-counter.php');
				return await response.text();
			})
		).toBe(count);
	}
});
