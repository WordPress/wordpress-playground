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

	async waitForPlaygroundShell(page = this.page) {
		const controls = [
			page.getByRole('navigation', { name: 'Playground tools' }),
			page.getByLabel('Open Site Manager'),
			page.getByRole('button', { name: /Site Manager/ }),
			page.getByRole('button', { name: /This Playground/ }),
		];
		const deadline = Date.now() + 120000;
		while (Date.now() < deadline) {
			const visibleControls = await Promise.all(
				controls.map((control) =>
					control.first().isVisible({ timeout: 1000 })
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
		await this.waitForPlaygroundShell();
		const dock = this.page.getByRole('navigation', {
			name: 'Playground tools',
		});
		if (await dock.isVisible()) {
			await this.openDockPane('Site Settings', 'Site Settings pane');
			return;
		}

		const siteManagerButton = this.page.getByRole('button', {
			name: /Site Manager/,
		});
		if ((await siteManagerButton.getAttribute('aria-pressed')) !== 'true') {
			await siteManagerButton.click();
		}
		await expect(
			this.page.locator('section[class*="site-info-panel"]')
		).toBeVisible();
	}

	async ensureSiteManagerIsClosed() {
		const dock = this.page.getByRole('navigation', {
			name: 'Playground tools',
		});
		if (await dock.isVisible()) {
			const pressedTool = dock.locator('button[aria-pressed="true"]');
			if ((await pressedTool.count()) > 0) {
				await pressedTool.first().click();
			}
		} else {
			const siteManagerButton = this.page.getByRole('button', {
				name: /Site Manager/,
			});
			if ((await siteManagerButton.count()) > 0) {
				const isPressed =
					await siteManagerButton.getAttribute('aria-pressed');
				if (isPressed === 'true') {
					await siteManagerButton.click();
				}
			}
		}
		await expect(
			this.page.locator('[role="dialog"][aria-label$=" pane"]')
		).not.toBeVisible();
	}

	/**
	 * Opens one Dock destination and waits for its pane to replace any old pane.
	 */
	async openDockPane(toolName: string, paneName = `${toolName} pane`) {
		const dock = this.page.getByRole('navigation', {
			name: 'Playground tools',
		});
		const tool = dock.getByRole('button', { name: toolName });
		if ((await tool.getAttribute('aria-pressed')) !== 'true') {
			await tool.click();
		}
		await expect(
			this.page.getByRole('dialog', { name: paneName })
		).toBeVisible();
	}

	/**
	 * Opens the Your Playgrounds pane and waits for its current content.
	 */
	async openPlaygroundsPane() {
		await this.openDockPane('Your Playgrounds');
	}

	/** Closes the Your Playgrounds pane when it is currently visible. */
	async closePlaygroundsPane() {
		const pane = this.page.getByRole('dialog', {
			name: 'Your Playgrounds pane',
		});
		if (await pane.isVisible()) {
			await this.page.keyboard.press('Escape');
		}
		await expect(pane).not.toBeVisible();
	}

	async getSiteTitle(): Promise<string> {
		return await this.page
			.locator('h1[class*="_site-info-header-details-name"]')
			.innerText();
	}
}
