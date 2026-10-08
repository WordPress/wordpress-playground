import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

test('preview tabs share writes with the supported PHP worker', async ({
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
					header('X-Playground-Worker: ' . (
						PLAYGROUND_SHARED_WORKER_CLIENT_URL ? 'shared' : 'dedicated'
					));
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
	const supportsExtendedLifetime = await page.evaluate(() => {
		if (typeof SharedWorker === 'undefined') {
			return false;
		}
		let supported = false;
		const url = URL.createObjectURL(
			new Blob([''], { type: 'text/javascript' })
		);
		try {
			const options: WorkerOptions & { extendedLifetime: boolean } = {
				get extendedLifetime() {
					supported = true;
					return true;
				},
			};
			const worker = new SharedWorker(url, options);
			worker.port.close();
			return supported;
		} finally {
			URL.revokeObjectURL(url);
		}
	});
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
			return {
				count: await response.text(),
				worker: response.headers.get('X-Playground-Worker'),
			};
		})
	).toEqual({
		count: '1',
		worker: supportsExtendedLifetime ? 'shared' : 'dedicated',
	});

	if (supportsExtendedLifetime) {
		await page.close();
	}
	// The dedicated fallback still needs the original tab. Both paths must keep
	// sharing posts and execute each PHP write once when the preview reloads.
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
	if (!supportsExtendedLifetime) {
		await page.reload();
		await expect(
			wordpress
				.getByRole('heading', { name: 'Shared across tabs' })
				.first()
		).toBeVisible();
		expect(
			await wordpress.locator('body').evaluate(async () => {
				const response = await fetch('tab-counter.php');
				return await response.text();
			})
		).toBe('1');
	}
});
