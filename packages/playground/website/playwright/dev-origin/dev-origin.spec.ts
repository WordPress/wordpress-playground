import { expect, test } from '@playwright/test';

// The override also configures the runtime when testing on private local ports.
const wordPressOrigin =
	process.env.VITE_WORDPRESS_SITE_URL || 'http://127.0.0.1:4400';

test('Vite keeps PHP on the app origin and renders WordPress on the remote port', async ({
	page,
}) => {
	await page.goto('./?wp=6.9&php=8.3&storage=temp');
	await page.waitForFunction(() => Boolean((window as any).playgroundSites));
	await page.evaluate(() => (window as any).playgroundSites.isReady());
	const iframe = page
		.frameLocator(
			'#playground-viewport:visible,.playground-viewport:visible'
		)
		.locator('#wp');
	await expect(iframe.contentFrame().locator('body')).not.toBeEmpty();
	const handle = (await iframe.elementHandle())!;
	const wordpress = (await handle.contentFrame())!;
	await handle.dispose();
	const appOrigin = new URL(page.url()).origin;
	expect(new URL(wordpress.url()).origin).toBe(wordPressOrigin);
	expect(new URL(wordpress.url()).pathname).toMatch(/^\/scope:/);
	expect(new URL(wordpress.parentFrame()!.url()).origin).toBe(appOrigin);
	expect(wordPressOrigin).not.toBe(appOrigin);

	// Exercise the actual PHP-to-HTTP relay, rather than accepting an error document
	// that would also refuse parent access. App API calls must keep working too.
	await page.evaluate(async () => {
		await (window as any).playgroundSites
			.getClient()
			.writeFile(
				'/wordpress/dev-origin.php',
				'<?php echo "HTTP from app-origin PHP";'
			);
	});
	expect(
		await wordpress.evaluate(async () =>
			(await fetch('dev-origin.php')).text()
		)
	).toBe('HTTP from app-origin PHP');
	expect(
		await wordpress.evaluate(async () => {
			const access: Record<string, string> = {};
			for (const frame of ['parent', 'top'] as const) {
				try {
					void window[frame].document.title;
					access[frame + 'Document'] = 'accessible';
				} catch (error) {
					access[frame + 'Document'] = (error as DOMException).name;
				}
				try {
					await window[frame].navigator.storage.getDirectory();
					access[frame + 'OPFS'] = 'accessible';
				} catch (error) {
					access[frame + 'OPFS'] = (error as DOMException).name;
				}
			}
			return access;
		})
	).toEqual({
		parentDocument: 'SecurityError',
		topDocument: 'SecurityError',
		parentOPFS: 'SecurityError',
		topOPFS: 'SecurityError',
	});

	// The initial network helper must be safe before any WordPress worker controls it.
	const helper = await page.request.get(
		wordPressOrigin + '/wordpress-bridge.html'
	);
	expect(helper.status()).toBe(200);
	expect(await helper.text()).toContain(
		appOrigin + '/src/lib/wordpress-bridge.ts'
	);
	for (const path of ['/api.html', '/remote.html', '/src/lib/config.ts']) {
		expect((await page.request.get(wordPressOrigin + path)).status()).toBe(
			404
		);
	}
	expect((await page.request.get(appOrigin + '/scope:probe/')).status()).toBe(
		404
	);

	// Thumbnail workers have a separate dev loader and must still fetch PHP resources.
	const thumbnail = await page.evaluate(() =>
		(window as any).playgroundSites.getClient().captureSiteThumbnail()
	);
	expect(['image/webp', 'image/jpeg']).toContain(thumbnail.mime);
	expect(Buffer.from(thumbnail.data, 'base64').length).toBeGreaterThan(100);
});
