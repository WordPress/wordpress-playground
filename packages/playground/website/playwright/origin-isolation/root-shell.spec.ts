import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const root = 'http://playground.localhost:9400';

test('the root keeps its document and the dock when switching isolated sites', async ({
	page,
}) => {
	await page.goto(root + '/?wp=6.9&php=8.3');
	let app = await readyApp(page);
	const alpha = new URL(app.url()).origin;
	await page.evaluate(() => ((window as any).rootToken = 'same root'));
	await app.evaluate(async () => {
		(window as any).appToken = 'same app';
		const api = (window as any).playgroundSites;
		await api
			.getClient()
			.writeFile('/wordpress/root-shell.txt', 'Alpha only');
		await api.getClient().flushOpfs('/wordpress');
		await api.saveInBrowser('Alpha');
		await api.rename('Alpha renamed');
	});
	await app.getByRole('button', { name: 'Dev Tools', exact: true }).click();
	expect(await app.evaluate(() => (window as any).appToken)).toBe('same app');
	await app.evaluate(() => {
		void (window as any).playgroundSites.createNewSavedSite('Beta');
	});
	await app.waitForURL((url) => url.origin !== alpha);
	app = await readyApp(page);
	const beta = new URL(app.url()).origin;
	expect(beta).not.toBe(alpha);
	expect(new URL(page.url()).origin).toBe(root);
	expect(await page.evaluate(() => (window as any).rootToken)).toBe(
		'same root'
	);
	expect(
		await app.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.fileExists('/wordpress/root-shell.txt')
		)
	).toBe(false);
	await app
		.getByRole('button', { name: 'Your Playgrounds', exact: true })
		.click();
	const alphaLink = app.getByRole('link', {
		name: 'Open Alpha renamed',
		exact: true,
	});
	expect(new URL(await alphaLink.getAttribute('href')!).origin).toBe(root);
	await alphaLink.click();
	await app.waitForURL((url) => url.origin === alpha);
	app = await readyApp(page);
	expect(
		await app.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.readFileAsText('/wordpress/root-shell.txt')
		)
	).toBe('Alpha only');
	expect(await page.evaluate(() => (window as any).rootToken)).toBe(
		'same root'
	);
	await page.goBack();
	await app.waitForURL((url) => url.origin === beta);
	app = await readyApp(page);
	expect(new URL(app.url()).origin).toBe(beta);
	expect(await page.evaluate(() => (window as any).rootToken)).toBe(
		'same root'
	);
});

test('a nested WordPress document cannot steer the root shell or read its storage', async ({
	page,
}) => {
	await page.goto(root + '/?wp=6.9&php=8.3');
	const app = await readyApp(page);
	await app.evaluate(async () => {
		const client = (window as any).playgroundSites.getClient();
		await client.writeFile(
			'/wordpress/root-message-probe.php',
			'<?php echo "Probe";'
		);
		const frame = document.createElement('iframe');
		frame.src = (await client.absoluteUrl) + '/root-message-probe.php';
		document.body.append(frame);
	});
	await expect
		.poll(() =>
			page
				.frames()
				.some((frame) =>
					frame.url().endsWith('/root-message-probe.php')
				)
		)
		.toBe(true);
	const wordpress = page
		.frames()
		.find((frame) => frame.url().endsWith('/root-message-probe.php'))!;
	const before = page.url();
	// The root sees an actual nested-window source, even though WordPress and its
	// own app share an origin. Only the selected app window may publish routes.
	await wordpress.evaluate((root) => {
		window.top!.postMessage(
			{
				type: 'playground-shell',
				action: 'navigate',
				url: root + '/?storage=temp',
			},
			root
		);
	}, root);
	await page.evaluate(
		() => new Promise((resolve) => setTimeout(resolve, 100))
	);
	expect(page.url()).toBe(before);
	expect(
		await wordpress.evaluate(() => {
			try {
				void window.top!.localStorage;
				return 'allowed';
			} catch (error) {
				return (error as DOMException).name;
			}
		})
	).toBe('SecurityError');
	expect(
		await page.evaluate(async () =>
			(await indexedDB.databases()).map((db) => db.name)
		)
	).not.toContain('fileSystemDB');
});

test('a saved-site link ignores an appended Blueprint instead of running it in saved files', async ({
	page,
}) => {
	await page.goto(root + '/?wp=6.9&php=8.3');
	let app = await readyApp(page);
	await app.evaluate(async () => {
		const api = (window as any).playgroundSites;
		await api.saveInBrowser('Saved');
		await api.getClient().flushOpfs('/wordpress');
	});
	const url = new URL(page.url());
	expect(url.searchParams.has('site')).toBe(true);
	url.hash = JSON.stringify({
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/injected.txt',
				data: 'should not run',
			},
		],
	});
	await page.goto(url.href);
	app = await readyApp(page);
	expect(
		await app.evaluate(() =>
			(window as any).playgroundSites
				.getClient()
				.fileExists('/wordpress/injected.txt')
		)
	).toBe(false);
});

for (const outcome of ['complete', 'retry', 'cancel'] as const) {
	test(`directory guide ${outcome} keeps the runtime mounted and native handles off the root`, async ({
		page,
		context,
	}) => {
		// This tests the guide's protocol, not Chrome's native permission UI. A
		// disposable OPFS handle avoids OS dialogs in CI. The native picker and
		// persistent grant require the separate, headed manual check.
		await context.addInitScript((outcome) => {
			(window as any).showDirectoryPicker = async () => {
				return (
					await navigator.storage.getDirectory()
				).getDirectoryHandle('guide-test-directory', { create: true });
			};
			if (
				window.location.pathname === '/local-directory.html' &&
				new URLSearchParams(window.location.search).get('phase') ===
					'check' &&
				outcome !== 'complete'
			) {
				const count = Number(
					sessionStorage.getItem('check-count') || '0'
				);
				sessionStorage.setItem('check-count', String(count + 1));
				if (!count)
					FileSystemDirectoryHandle.prototype.queryPermission =
						async () => 'prompt';
			}
		}, outcome);
		await page.goto(root + '/?wp=6.9&php=8.3');
		const app = await readyApp(page);
		await app.evaluate(
			() => ((window as any).appToken = 'same running app')
		);
		await app
			.getByRole('button', { name: 'Autosaved', exact: true })
			.click();
		const pane = app.locator(
			'section[aria-label="Store permanently pane"]'
		);
		await expect(
			pane.getByText('Save in a local directory (not available)')
		).toHaveCount(0);
		await pane
			.getByRole('radio', { name: /Save in a local directory/ })
			.check();
		await expect(pane).toContainText('Your Playground stays open here');
		const opened = context.waitForEvent('page');
		await pane.getByRole('button', { name: 'Choose...' }).click();
		const popup = await opened;
		await popup
			.getByRole('button', { name: 'Choose directory', exact: true })
			.click();
		await popup
			.getByRole('button', { name: 'Allow ongoing access', exact: true })
			.click();
		if (outcome !== 'complete') {
			await expect(
				popup.getByText(
					'Access ended when the permission step finished.',
					{ exact: false }
				)
			).toBeVisible();
			await expect(
				pane.getByRole('button', { name: 'Save', exact: true })
			).toBeDisabled();
			if (outcome === 'cancel') {
				await popup
					.getByRole('button', { name: 'Cancel', exact: true })
					.click();
			} else {
				await popup
					.getByRole('button', {
						name: 'Try persistent access again',
					})
					.click();
				await popup
					.getByRole('button', {
						name: 'Allow ongoing access',
						exact: true,
					})
					.click();
			}
		}
		await expect.poll(() => popup.isClosed()).toBe(true);
		await expect(
			pane.getByRole('button', { name: 'Choose...' })
		).toBeEnabled();
		if (outcome === 'cancel') {
			await expect(
				pane.getByRole('button', { name: 'Save', exact: true })
			).toBeDisabled();
		} else {
			await expect(
				pane.getByRole('button', { name: 'Save', exact: true })
			).toBeEnabled();
			await expect(
				pane.getByPlaceholder('Choose a directory...')
			).toHaveValue('guide-test-directory');
		}
		expect(await app.evaluate(() => (window as any).appToken)).toBe(
			'same running app'
		);
		expect(new URL(page.url()).origin).toBe(root);
		expect(
			await page.evaluate(async () =>
				(await indexedDB.databases()).map((db) => db.name)
			)
		).not.toContain('fileSystemDB');
		expect(
			await app.evaluate(async () => {
				const open = indexedDB.open('fileSystemDB', 1);
				const db = await new Promise<IDBDatabase>(
					(resolve) => (open.onsuccess = () => resolve(open.result))
				);
				const request = db
					.transaction('fileSystemStore')
					.objectStore('fileSystemStore')
					.getAllKeys();
				return await new Promise(
					(resolve) =>
						(request.onsuccess = () => resolve(request.result))
				);
			})
		).toEqual([]);
		if (outcome === 'complete') {
			await app.evaluate(() =>
				(window as any).playgroundSites
					.getClient()
					.writeFile(
						'/wordpress/local-marker.txt',
						'Saved through the same-origin handle'
					)
			);
			await pane
				.getByRole('button', { name: 'Save', exact: true })
				.click();
			await expect(pane).not.toBeVisible();
			expect(
				await app.evaluate(
					() => (window as any).playgroundSites.list()[0].storage
				)
			).toBe('local-fs');
			await page.reload();
			const reopened = await readyApp(page);
			expect(
				await reopened.evaluate(() =>
					(window as any).playgroundSites
						.getClient()
						.readFileAsText('/wordpress/local-marker.txt')
				)
			).toBe('Saved through the same-origin handle');
		}
	});
}

/** Wait for both PHP readiness and the initial durable copy before asserting persistence. */
async function readyApp(page: Page) {
	const frame = await (await page
		.locator('iframe[title="Playground"]')
		.elementHandle())!.contentFrame();
	await frame!.waitForFunction(() =>
		Boolean((window as any).playgroundSites)
	);
	await frame!.evaluate(() => (window as any).playgroundSites.isReady());
	// PHP readiness precedes the initial durable copy and OPFS mount.
	await expect
		.poll(() =>
			frame!.evaluate(async () => {
				const site = (window as any).playgroundSites
					.list()
					.find((site: any) => site.isActive);
				if (site.storage !== 'opfs') return true;
				try {
					const sites = await (
						await navigator.storage.getDirectory()
					).getDirectoryHandle('sites');
					const directory = await sites.getDirectoryHandle(
						'site-' + encodeURIComponent(site.slug)
					);
					return (
						JSON.parse(
							await (
								await (
									await directory.getFileHandle(
										'wp-runtime.json'
									)
								).getFile()
							).text()
						).initialOpfsSyncPending === false
					);
				} catch {
					return false;
				}
			})
		)
		.toBe(true);
	await expect(
		frame!.getByRole('navigation', { name: 'Playground tools' })
	).toBeVisible();
	return frame!;
}
