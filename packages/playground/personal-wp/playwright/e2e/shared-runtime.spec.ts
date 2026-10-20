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

test('asks a stale document to reload without retiring the active runtime', async ({
	page,
	context,
}) => {
	let stale = false;
	await context.route('**/personal-wp-version.json', async (route) => {
		if (stale)
			await route.fulfill({ json: { buildVersion: 'next-deployment' } });
		else await route.continue();
	});
	await connect(page);
	await page.evaluate(() =>
		(window as any).playground.writeFile('/memory-marker', 'still active')
	);
	stale = true;
	const second = await context.newPage();
	await second.goto('./', { waitUntil: 'domcontentloaded' });
	await expect(
		second.getByRole('dialog', { name: 'My WordPress has been updated' })
	).toBeVisible();
	expect(
		await page.evaluate(() =>
			(window as any).playground.readFileAsText('/memory-marker')
		)
	).toBe('still active');
	await expect(
		page.getByRole('dialog', { name: 'My WordPress has been updated' })
	).toBeHidden();
	stale = false;
	await second.getByRole('button', { name: 'Reload this tab' }).click();
	await second.waitForFunction(() => !!(window as any).playground);
	await second.evaluate(() => (window as any).playground.isReady());
	expect(
		await second.evaluate(() =>
			(window as any).playground.readFileAsText('/memory-marker')
		)
	).toBe('still active');
});

test('boots a replacement runtime without reloading the new tab after retirement', async ({
	page,
	context,
}) => {
	await connect(page);
	await page.evaluate(() =>
		(window as any).playground.writeFile(
			'/wordpress/shared-runtime-persisted.txt',
			'saved before update'
		)
	);
	const httpTab = await context.newPage();
	await connect(httpTab);
	await httpTab.evaluate(async () =>
		(await fetch('/scope:default/shared-runtime-persisted.txt')).text()
	);
	// Exercise the real shutdown protocol separately from deployment-version detection.
	await page.evaluate(() =>
		(window as any).playground.shutdownSharedRuntime()
	);
	await expect(
		page.getByRole('dialog', { name: 'My WordPress has been updated' })
	).toBeVisible();
	await expect(
		httpTab.getByRole('dialog', { name: 'My WordPress has been updated' })
	).toBeVisible();
	const second = await context.newPage();
	let navigations = 0;
	second.on('request', (request) => {
		if (
			request.isNavigationRequest() &&
			request.frame() === second.mainFrame()
		)
			navigations++;
	});
	await connect(second);
	await expect(
		second.getByRole('dialog', { name: 'My WordPress has been updated' })
	).toBeHidden();
	expect(navigations).toBe(1);
	expect(
		await second.evaluate(() =>
			(window as any).playground.readFileAsText(
				'/wordpress/shared-runtime-persisted.txt'
			)
		)
	).toBe('saved before update');
	expect(
		await httpTab.evaluate(
			async () => (await fetch('/scope:default/wp-json/')).status
		)
	).toBe(503);
	await page.getByRole('button', { name: 'Reload this tab' }).click();
	await page.waitForFunction(() => !!(window as any).playground);
	await page.evaluate(() => (window as any).playground.isReady());
	expect(
		await page.evaluate(() =>
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
