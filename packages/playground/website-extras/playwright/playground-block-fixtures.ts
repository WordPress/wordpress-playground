import type { FrameLocator, Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

type PlaygroundBlockFixtures = {
	/**
	 * The WordPress iframe inside the playground viewport.
	 */
	wordpress: FrameLocator;
	/**
	 * A helper class to interact with the playground block frame page.
	 */
	playgroundBlock: PlaygroundBlockPage;
};

export class PlaygroundBlockPage {
	public readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/**
	 * Wait for WordPress to fully load inside the Playground iframe.
	 * WordPress Playground can take a while to boot, so we use a generous timeout.
	 *
	 * The iframe structure is:
	 * 1. Main page: playground-block-frame.html
	 * 2. First iframe: .playground-iframe (which loads remote.html)
	 * 3. Second iframe (inside remote.html): #wp (the actual WordPress site)
	 */
	async waitForWordPressIframe(page = this.page) {
		await expect(
			page
				.frameLocator('.playground-iframe')
				.frameLocator('#wp')
				.locator('body')
		).not.toBeEmpty({ timeout: 120000 });
	}

	/**
	 * Get the WordPress iframe locator.
	 */
	wordpress(page = this.page) {
		return page.frameLocator('.playground-iframe').frameLocator('#wp');
	}

	/**
	 * Navigate to a URL and wait for WordPress to load.
	 * URLs should be relative to the baseURL configured in playwright.config.ts
	 */
	async goto(url: string, options?: any) {
		// Resolve relative URLs against the baseURL
		const baseURL =
			process.env.PLAYWRIGHT_TEST_BASE_URL ||
			'http://127.0.0.1:6400/website-extras/';
		const resolvedUrl = url.startsWith('./')
			? baseURL + url.slice(2)
			: url.startsWith('/')
				? baseURL + url.slice(1)
				: url;

		const response = await this.page.goto(resolvedUrl, options);
		await this.waitForWordPressIframe();
		return response;
	}

	/**
	 * Check if the code editor is visible.
	 */
	async isCodeEditorVisible(): Promise<boolean> {
		const editor = this.page.locator('.cm-editor');
		return editor.isVisible();
	}

	/**
	 * Get the code editor content.
	 */
	async getCodeEditorContent(): Promise<string> {
		const cmContent = this.page.locator('.cm-content');
		return cmContent.innerText();
	}

	/**
	 * Wait for the code editor to be ready.
	 */
	async waitForCodeEditor() {
		await expect(this.page.locator('.cm-editor')).toBeVisible({
			timeout: 30000,
		});
	}

	/**
	 * Click the Run button to apply changes.
	 */
	async clickRunButton() {
		const runButton = this.page.getByRole('button', { name: /Run/i });
		await runButton.click();
	}
}

export const test = base.extend<PlaygroundBlockFixtures>({
	wordpress: async ({ page }, use) => {
		const wpFrame = page
			.frameLocator('.playground-iframe')
			.frameLocator('#wp');
		await use(wpFrame);
	},
	playgroundBlock: async ({ page }, use) => {
		await use(new PlaygroundBlockPage(page));
	},
});

export { expect } from '@playwright/test';
