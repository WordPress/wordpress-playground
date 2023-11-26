import { Page, ElementHandle, Frame } from '@playwright/test';

export const remoteFrame = async function (page: Page) {
	const iframe = await page.waitForSelector('iframe');
	return await iframe.contentFrame();
};

export const wordPressIFrame = async function (page: Page) {
	const remote = await remoteFrame(page);
	if (!remote) {
		throw new Error(`Cannot find the WordPress iframe`);
	}
	return await remote?.waitForSelector('iframe');
};

export const wordPressFrame = async function (page: Page) {
	const iframe = await wordPressIFrame(page);
	const frame = await iframe?.contentFrame();
	return frame!;
};

export const setWordPressUrl = async function (page: Page, url: string) {
	// @TODO: Find a better way to wait for navigation bar to be ready
	await page.waitForTimeout(3000);

	const urlInput = await page.waitForSelector('input[name=url]');
	await urlInput.waitForElementState('visible');
	await urlInput.fill(url);
	await urlInput.press('Enter');

	// Wait for WordPress to reload
	const wpFrame = await wordPressFrame(page);
	await wpFrame.waitForURL(new RegExp(escapeRegExp(url)));
};

function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
