import type { ConsoleMessage, FrameLocator } from '@playwright/test';
import { test as base } from '@playwright/test';
import { WebsitePage } from './website-page';

type WordPressFixtures = {
	wordpress: FrameLocator;
	website: WebsitePage;
};

export const test = base.extend<WordPressFixtures>({
	wordpress: async ({ page }, use) => {
		const wpPage = page
			/* There are multiple viewports possible, so we need to select
			   the one that is visible. */
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp');
		await use(wpPage);
	},
	website: async ({ page }, use, testInfo) => {
		const diagnostics: string[] = [];
		const formatConsoleMessage = (message: ConsoleMessage) =>
			`[console:${message.type()}] ${message.text()}`;

		page.on('console', (message) => {
			diagnostics.push(formatConsoleMessage(message));
		});
		page.on('pageerror', (error) => {
			diagnostics.push(
				`[pageerror] ${error.stack || error.message || String(error)}`
			);
		});
		page.on('requestfailed', (request) => {
			diagnostics.push(
				`[requestfailed] ${request.method()} ${request.url()} ${
					request.failure()?.errorText ?? ''
				}`
			);
		});
		page.on('worker', (worker) => {
			diagnostics.push(`[worker] ${worker.url()}`);
			worker.on('close', () => {
				diagnostics.push(`[worker:closed] ${worker.url()}`);
			});
		});

		await use(new WebsitePage(page));

		if (diagnostics.length) {
			const body = diagnostics.join('\n');
			console.log(body);
			await testInfo.attach('browser-diagnostics.txt', {
				body,
				contentType: 'text/plain',
			});
		}
	},
});

export { expect, Page } from '@playwright/test';
