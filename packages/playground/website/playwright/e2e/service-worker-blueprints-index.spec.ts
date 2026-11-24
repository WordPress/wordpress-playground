import { test, expect } from '@playwright/test';

test('the service worker rejects arbitrary-content proxy navigations', async ({
	page,
}) => {
	// The removed proxy was a service-worker route, not an HTTP server route.
	await page.goto('/remote.html');
	await page.waitForFunction(() => !!navigator.serviceWorker.controller);

	const payload =
		'<script>window.arbitraryProxyScriptExecuted = true</script>';
	const attackUrl = new URL(
		'/proxy/network-first-fetch/data:text/html;base64,' +
			Buffer.from(payload).toString('base64'),
		page.url()
	);
	// The old URL must also bypass any response left in the app's asset cache.
	await page.evaluate(
		async ({ url, payload }) => {
			const cacheName = (await caches.keys()).find((name) =>
				name.startsWith('playground-cache-')
			);
			if (!cacheName) {
				throw new Error(
					'The service worker did not open its asset cache.'
				);
			}
			const cache = await caches.open(cacheName);
			await cache.put(
				url,
				new Response(payload, {
					headers: { 'Content-Type': 'text/html' },
				})
			);
		},
		{ url: attackUrl.href, payload }
	);
	const response = await page.goto(attackUrl.href);

	expect(response?.status()).toBe(404);
	expect(
		await page.evaluate(() => (window as any).arbitraryProxyScriptExecuted)
	).toBeUndefined();
});
