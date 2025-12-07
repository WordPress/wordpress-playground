import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class WebsitePage {
	public readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// Wait for WordPress to load
	async waitForNestedIframes(page = this.page) {
		await expect(
			page
				/* There are multiple viewports possible, so we need to select
				   the one that is visible. */
				.frameLocator(
					'#playground-viewport:visible,.playground-viewport:visible'
				)
				.frameLocator('#wp')
				.locator('body')
		).not.toBeEmpty();
	}

	wordpress(page = this.page) {
		return (
			page
				/* There are multiple viewports possible, so we need to select
			   the one that is visible. */
				.frameLocator(
					'#playground-viewport:visible,.playground-viewport:visible'
				)
				.frameLocator('#wp')
		);
	}

	async goto(url: string, options?: any) {
		const originalGoto = this.page.goto.bind(this.page);
		const response = await originalGoto(url, options);
		await this.waitForNestedIframes();
		return response;
	}

	async ensureSiteManagerIsOpen() {
		const siteManager = this.page.locator('.main-sidebar');
		if (!(await siteManager.isVisible())) {
			await this.page
				.getByRole('button', { name: 'Open Site Manager' })
				.click();
		}
		await expect(siteManager).toBeVisible();
	}

	async ensureSiteManagerIsClosed() {
		const siteManager = this.page.locator('.main-sidebar');
		if (await siteManager.isVisible()) {
			const closeButton = this.page.getByRole('button', {
				name: 'Close Site Manager',
			});
			if (await closeButton.isVisible()) {
				await closeButton.click();
			}
		}
		await expect(siteManager).not.toBeVisible();
	}

	async getSiteTitle(): Promise<string> {
		return await this.page
			.locator('h1[class*="_site-info-header-details-name"]')
			.innerText();
	}
}
