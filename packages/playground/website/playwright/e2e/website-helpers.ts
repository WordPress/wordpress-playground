import { expect, Page } from '../playground-fixtures.ts';

export const expandSiteView = async (page: Page) => {
	const openSiteButton = page.locator('div[title="Open site"]');
	await expect(openSiteButton).toBeVisible();
	await openSiteButton.click();
};

export const openNewSiteModal = async (page: Page) => {
	const addPlaygroundButton = page.locator('button.components-button', {
		hasText: 'Add Playground',
	});
	await expect(addPlaygroundButton).toBeVisible();
	await addPlaygroundButton.click();
};

export const clickCreateInNewSiteModal = async (page: Page) => {
	const createTempPlaygroundButton = page.locator(
		'button.components-button',
		{
			hasText: 'Create a temporary Playground',
		}
	);
	await expect(createTempPlaygroundButton).toBeVisible();
	await createTempPlaygroundButton.click();
};

export const getSiteTitle = async (page: Page) => {
	return await page
		.locator('h1[class*="_site-info-header-details-name"]')
		.innerText();
};

export const openEditSettings = async (page: Page) => {
	const editSettingsButton = page.locator('button.components-button', {
		hasText: 'Edit Playground settings',
	});
	await expect(editSettingsButton).toBeVisible();
	await editSettingsButton.click();
};

export const selectPHPVersion = async (page: Page, version: string) => {
	const phpVersionSelect = page.locator('select[name=phpVersion]');
	await expect(phpVersionSelect).toBeVisible();
	await phpVersionSelect.selectOption(version);
};

export const clickSaveInEditSettings = async (page: Page) => {
	const saveSettingsButton = page.locator(
		'button.components-button.is-primary',
		{
			hasText: 'Update',
		}
	);
	await expect(saveSettingsButton).toBeVisible();
	await saveSettingsButton.click();
};

export const validatePHPVersion = async (page: Page, version: string) => {
	const textContent = await page
		.locator('div.components-flex-item')
		.allTextContents();
	expect(textContent).toContain(version);
};
