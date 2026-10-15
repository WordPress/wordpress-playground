import { test, expect } from '../playground-fixtures';
import type { Page } from '@playwright/test';

test('shares the runtime, serves each request once, and survives the first tab closing', async ({
	page,
	context,
}) => {
	await connect(page);
	await page.evaluate(async () => {
		const client = (window as any).playground;
		await client.writeFile('/shared-runtime-marker', 'shared memory');
		await client.writeFile(
			'/wordpress/shared-runtime-request.php',
			`<?php
$countFile = '/wordpress/shared-runtime-count';
file_put_contents($countFile, "request\\n", FILE_APPEND);
echo count(file($countFile));`
		);
	});
	const second = await context.newPage();
	await connect(second);
	expect(
		await second.evaluate(async () =>
			(window as any).playground.readFileAsText('/shared-runtime-marker')
		)
	).toBe('shared memory');
	expect(
		await second.evaluate(async () =>
			(await fetch('/scope:default/shared-runtime-request.php')).text()
		)
	).toBe('1');
	await page.close();
	expect(
		await second.evaluate(async () =>
			(await fetch('/scope:default/shared-runtime-request.php')).text()
		)
	).toBe('2');

	// ServiceWorker state can be evicted independently of the shared PHP runtime.
	const session = await context.newCDPSession(second);
	await session.send('ServiceWorker.enable');
	await session.send('ServiceWorker.stopAllWorkers');
	expect(
		await second.evaluate(async () =>
			(window as any).playground.readFileAsText('/shared-runtime-marker')
		)
	).toBe('shared memory');
	expect(
		await second.evaluate(async () =>
			(await fetch('/scope:default/shared-runtime-request.php')).text()
		)
	).toBe('3');
});

test('checks deployment on new-tab startup and retires the stale runtime before reloading', async ({
	page,
	context,
}) => {
	let deployedVersion: string | undefined;
	let checks = 0;
	await context.route('**/personal-wp-version.json', async (route) => {
		checks++;
		if (deployedVersion) {
			await route.fulfill({ json: { buildVersion: deployedVersion } });
		} else await route.continue();
	});
	await connect(page);
	await page.evaluate(async () =>
		(window as any).playground.writeFile(
			'/wordpress/shared-runtime-persisted.txt',
			'saved before update'
		)
	);
	const httpTab = await context.newPage();
	await connect(httpTab);
	deployedVersion = 'next-deployment';
	const second = await context.newPage();
	await second.goto('./', { waitUntil: 'domcontentloaded' });
	await expect(
		second.getByRole('dialog', { name: 'A new version is available' })
	).toBeVisible();

	// The old tab is asked to reload when it next uses the runtime.
	await page.evaluate(() => {
		// The reload screen removes the remote iframe, so observe the UI rather than
		// awaiting a reply through the connection being destroyed.
		void (window as any).playground
			.readFileAsText('/wordpress/shared-runtime-persisted.txt')
			.catch(() => {});
	});
	await expect(
		page.getByRole('dialog', { name: 'A new version is available' })
	).toBeVisible();
	const status = await httpTab.evaluate(
		async () => (await fetch('/scope:default/wp-json/')).status
	);
	expect(status).toBe(503);
	await expect(
		httpTab.getByRole('dialog', { name: 'A new version is available' })
	).toBeVisible();
	expect(checks).toBe(3);

	deployedVersion = undefined;
	await second.getByRole('button', { name: 'Reload this tab' }).click();
	await second.waitForFunction(() => !!(window as any).playground);
	expect(
		await second.evaluate(async () =>
			(window as any).playground.readFileAsText(
				'/wordpress/shared-runtime-persisted.txt'
			)
		)
	).toBe('saved before update');
});

async function connect(page: Page) {
	await page.goto('./', { waitUntil: 'domcontentloaded' });
	await page.waitForFunction(() => !!(window as any).playground);
	await page.evaluate(async () => {
		await (window as any).playground.isReady();
	});
}
