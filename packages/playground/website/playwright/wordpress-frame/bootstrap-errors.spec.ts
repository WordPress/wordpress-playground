import { expect, test } from '@playwright/test';
import { appOrigin } from '../../bin/wordpress-frame/origins.mjs';

// The fallback must execute even when the module graph providing the normal
// error UI never loads. The recovery UI must not depend on that module graph.
for (const status of [403, 404]) {
	test(`an embedded bootstrap failure shows recovery UI after HTTP ${status}`, async ({
		page,
	}) => {
		test.setTimeout(60000);
		await page.route('**/__bootstrap-host.html', (route) =>
			route.fulfill({
				contentType: 'text/html',
				body: '<iframe id="remote" src="/remote.html" style="width:100%;height:800px"></iframe>',
			})
		);
		let blocked = 0;
		await page.route('**/*.js', (route) => {
			blocked++;
			return route.fulfill({
				status,
				contentType: 'text/html',
				headers: { 'Cache-Control': 'no-store' },
				body: 'Unavailable',
			});
		});
		await page.goto(appOrigin + '/__bootstrap-host.html');
		const remote = page.frameLocator('#remote');
		const retry = remote.getByRole('button', {
			name: 'Try again',
			exact: true,
		});
		await expect(retry).toBeVisible();
		expect(blocked).toBeGreaterThan(0);
	});
}
