import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class WebsitePage {
	public readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// Wait for WordPress to load
	async waitForNestedIframes(page = this.page) {
		const wordpressBody = page
			/* There are multiple viewports possible, so we need to select
			   the one that is visible. */
			.frameLocator('#playground-viewport:visible,.playground-viewport:visible')
			.frameLocator('#wp')
			.locator('body');

		// WP (especially when booting from a blueprint-url) can take longer than the
		// default expect timeout on CI, particularly in Firefox.
		await expect(wordpressBody).not.toBeEmpty({ timeout: 120000 });

		// The nested iframe can briefly show remote.html during reloads; wait until we
		// actually have the WordPress document loaded.
		await expect
			.poll(
				async () => {
					try {
						// Use window.location (not Element.baseURI) so we don't get
						// tripped up by <base> tags or other base URL shenanigans.
						const href = await wordpressBody.evaluate(
							() => window.location.href
						);
						return (
							href.startsWith('http') &&
							!href.includes('/remote.html')
						);
					} catch {
						return false;
					}
				},
				{ timeout: 120000 }
			)
			.toBe(true);
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
		const overlay = this.page
			.locator('[class*="overlay"]')
			.filter({ hasText: 'Playground' });

		// Make this method idempotent. Some flows can already have the overlay open
		// (e.g. a previous click, or tests that call this helper twice).
		if (await overlay.isVisible()) {
			return;
		}

		const button = this.page.getByRole('button', {
			name: 'Saved Playgrounds',
		});
		const expanded = await button.getAttribute('aria-expanded');
		if (expanded === 'true') {
			await expect(overlay).toBeVisible();
			return;
		}

		await button.click();
		await expect(overlay).toBeVisible();
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
