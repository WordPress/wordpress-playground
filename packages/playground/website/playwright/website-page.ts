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
		const siteManagerButton = this.page.getByRole('button', {
			name: /Site Manager/,
		});
		const isPressed = await siteManagerButton.getAttribute('aria-pressed');
		if (isPressed !== 'true') {
			await siteManagerButton.click();
		}
		// Wait for the site info panel section to be visible
		await expect(
			this.page.locator('section[class*="site-info-panel"]')
		).toBeVisible();
	}

	async ensureSiteManagerIsClosed() {
		const siteManagerButton = this.page.getByRole('button', {
			name: /Site Manager/,
		});
		const isPressed = await siteManagerButton.getAttribute('aria-pressed');
		if (isPressed === 'true') {
			await siteManagerButton.click();
		}
		// Wait for the site info panel section to be hidden
		await expect(
			this.page.locator('section[class*="site-info-panel"]')
		).not.toBeVisible();
	}

	async openSavedPlaygroundsOverlay() {
		await this.page
			.getByRole('button', { name: 'Saved Playgrounds' })
			.click();
		await expect(
			this.page
				.locator('[class*="overlay"]')
				.filter({ hasText: 'Playground' })
		).toBeVisible();
	}

	async closeSavedPlaygroundsOverlay() {
		const overlay = this.page
			.locator('[class*="overlay"]')
			.filter({ hasText: 'Playground' });
		if (await overlay.isVisible()) {
			await this.page.keyboard.press('Escape');
		}
		await expect(overlay).not.toBeVisible();
	}

	async getSiteTitle(): Promise<string> {
		return await this.page
			.locator('h1[class*="_site-info-header-details-name"]')
			.innerText();
	}
}
