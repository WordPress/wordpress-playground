import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class PersonalWPPage {
	public readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async waitForNestedIframes() {
		await expect(this.wordpress().locator('body')).not.toBeEmpty();
	}

	wordpress() {
		return this.page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp');
	}

	async goto(url: string, options?: Parameters<Page['goto']>[1]) {
		const originalGoto = this.page.goto.bind(this.page);
		const response = await originalGoto(url, options);
		await this.waitForNestedIframes();
		return response;
	}

	async ensureSiteToolsIsOpen() {
		const button = this.page.getByRole('button', {
			name: /Open Site Tools/,
		});
		if (await button.isVisible()) {
			await button.click();
		}
	}

	async ensureSiteToolsIsClosed() {
		const button = this.page.getByRole('button', {
			name: /Close Site Tools/,
		});
		if (await button.isVisible()) {
			await button.click();
		}
	}

	async openMenuOverlay() {
		await this.page
			.getByRole('button', { name: 'Playground Menu' })
			.click();
	}

	addressBar() {
		return this.page
			.locator('header[aria-label="Playground toolbar"]')
			.locator('input[type="text"]');
	}
}
