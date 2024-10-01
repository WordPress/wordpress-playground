import { Page, expect, Locator } from '@playwright/test';

export class WebsitePage {
	constructor(public readonly page: Page) {}

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
	async goto(url: string, options?: any) {
		const originalGoto = this.page.goto.bind(this.page);
		const response = await originalGoto(url, options);
		await this.waitForNestedIframes();
		return response;
	}

	async ensureSiteManagerIsOpen() {
		const siteManagerHeading = this.page.getByText('Your Playgrounds');
		if (!(await siteManagerHeading.isVisible({ timeout: 5000 }))) {
			await this.page.getByLabel('Open Site Manager').click();
		}
		expect(await siteManagerHeading.isVisible()).toBeTruthy();
	}

	async ensureSiteViewIsExpanded() {
		const openSiteButton = this.page.locator('div[title="Open site"]');
		if (await openSiteButton.isVisible({ timeout: 5000 })) {
			await openSiteButton.click();
		}

		const siteManagerHeading = this.page.getByText('Your Playgrounds');
		expect(await siteManagerHeading.isVisible()).toBeFalsy();
	}

	async openNewSiteModal() {
		const addPlaygroundButton = this.page.locator(
			'button.components-button',
			{
				hasText: 'Add Playground',
			}
		);
		await addPlaygroundButton.click();
	}

	async clickCreateInNewSiteModal() {
		const createTempPlaygroundButton = this.page.locator(
			'button.components-button',
			{
				hasText: 'Create a temporary Playground',
			}
		);
		await createTempPlaygroundButton.click();
	}

	async getSiteTitle(): Promise<string> {
		return await this.page
			.locator('h1[class*="_site-info-header-details-name"]')
			.innerText();
	}

	async openForkPlaygroundSettings() {
		await this.ensureSiteManagerIsOpen();
		const editSettingsButton = this.page.locator(
			'button.components-button',
			{
				hasText: 'Create a similar Playground',
			}
		);
		await editSettingsButton.click({ timeout: 5000 });
	}

	async selectPHPVersion(version: string) {
		const phpVersionSelect = this.page.locator('select[name=phpVersion]');
		await phpVersionSelect.selectOption(version);
	}

	async clickSaveInForkPlaygroundSettings() {
		const saveSettingsButton = this.page.locator(
			'button.components-button.is-primary',
			{
				hasText: 'Create',
			}
		);
		await saveSettingsButton.click();
	}

	async selectWordPressVersion(version: string) {
		const wordpressVersionSelect = this.page.locator(
			'select[name=wpVersion]'
		);
		await wordpressVersionSelect.selectOption(version);
	}

	async getSiteInfoRowLocator(key: string): Promise<Locator> {
		return this.page.getByLabel(key);
	}

	async setNetworkingEnabled(enabled: boolean) {
		const checkbox = this.page.locator('input[name="withNetworking"]');
		if (enabled) {
			await checkbox.check();
		} else {
			await checkbox.uncheck();
		}
	}

	async hasNetworkingEnabled(): Promise<boolean> {
		const networkAccessText = await (
			await this.getSiteInfoRowLocator('Network access')
		).innerText();
		return networkAccessText === 'Yes';
	}
}
