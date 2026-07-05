import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const WORDPRESS_BOOT_TIMEOUT = 120000;

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
		).not.toBeEmpty({ timeout: WORDPRESS_BOOT_TIMEOUT });
	}

	async waitForPlaygroundShell(page = this.page) {
		const controls = [
			page.getByRole('button', { name: /Site details/ }),
			page.getByLabel('Open Site Manager'),
			page.getByRole('button', { name: /Site Manager/ }),
			page.getByRole('button', { name: /This Playground/ }),
		];
		const deadline = Date.now() + 120000;
		while (Date.now() < deadline) {
			const visibleControls = await Promise.all(
				controls.map((control) =>
					control
						.first()
						.isVisible({ timeout: 1000 })
						.catch(() => false)
				)
			);
			if (visibleControls.some(Boolean)) {
				return;
			}
			await page.waitForTimeout(500);
		}
		throw new Error('Timed out waiting for Playground shell controls');
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
			name: /Site details/,
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
		const panel = this.page.locator(
			'section[role="dialog"][aria-label$=" pane"]'
		);
		if (await panel.isVisible({ timeout: 1000 }).catch(() => false)) {
			const activeTool = this.page
				.locator(
					'nav[aria-label="Playground tools"] button[aria-pressed="true"]'
				)
				.first();
			if (
				await activeTool.isVisible({ timeout: 1000 }).catch(() => false)
			) {
				await activeTool.click({ timeout: 5000 }).catch(async () => {
					await this.page.keyboard.press('Escape');
				});
			} else {
				await this.page.keyboard.press('Escape');
			}
		}
		await expect(panel).not.toBeVisible();
	}

	/**
	 * Opens the Your Playgrounds pane and waits for its content to render.
	 */
	async openSavedPlaygroundsOverlay() {
		const pane = this.page.getByRole('dialog', {
			name: 'Your Playgrounds pane',
		});
		if (!(await pane.isVisible({ timeout: 1000 }).catch(() => false))) {
			await this.page
				.getByRole('button', { name: 'Your Playgrounds' })
				.click();
		}
		await expect(pane).toBeVisible();
	}

	async openSavedPlayground(name: string) {
		const overlay = this.page.getByRole('dialog', {
			name: 'Your Playgrounds pane',
		});
		const row = overlay.getByRole('button', {
			name: new RegExp(`^Open ${escapeRegExp(name)}$`),
		});
		await expect(row).toBeVisible();
		await waitForPaneAnimations(overlay);
		await row.click();
	}

	async startNewVanillaPlayground() {
		const vanillaWordPressButton = this.page.getByRole('button', {
			name: /Vanilla WordPress/,
		});
		if (
			!(await vanillaWordPressButton
				.isVisible({ timeout: 1000 })
				.catch(() => false))
		) {
			await this.page
				.locator('nav[aria-label="Playground tools"]')
				.getByRole('button', { name: 'New Playground' })
				.click();
		}
		await vanillaWordPressButton.click();
	}

	async closeSavedPlaygroundsOverlay() {
		const pane = this.page.getByRole('dialog', {
			name: 'Your Playgrounds pane',
		});
		if (await pane.isVisible({ timeout: 1000 }).catch(() => false)) {
			await this.page
				.getByRole('button', { name: 'Your Playgrounds' })
				.click();
		}
		await expect(pane).not.toBeVisible();
	}

	async getSiteTitle(): Promise<string> {
		return await this.page
			.locator('h1[class*="_site-info-header-details-name"]')
			.innerText();
	}
}

async function waitForPaneAnimations(pane: Locator) {
	await pane.evaluate(async (element) => {
		const animations = element
			.getAnimations({ subtree: true })
			.filter(
				(animation) =>
					animation.playState === 'running' ||
					animation.playState === 'pending'
			);
		if (animations.length === 0) {
			return;
		}
		await Promise.race([
			Promise.allSettled(
				animations.map((animation) => animation.finished)
			),
			new Promise((resolve) => setTimeout(resolve, 500)),
		]);
	});
}

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
