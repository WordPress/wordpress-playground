import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { appOrigin } from '../bin/wordpress-frame/origins.mjs';

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

	/**
	 * Navigate and explicitly select saved sites through the real website UI.
	 *
	 * Most tests need a running client. Saved-site URL tests must use page.goto()
	 * instead, then check that nothing boots before clicking a list entry. Keep
	 * the sandbox opt-in in two-host CI; it does not change the startup rule.
	 */
	async goto(url: string, options?: any) {
		if (process.env.PLAYWRIGHT_WORDPRESS_FRAME === '1') {
			const target = new URL(url, appOrigin + '/');
			if (target.hostname === 'playground.localhost') {
				target.searchParams.set('reprint', '');
				url = target.href;
			}
		}
		const originalGoto = this.page.goto.bind(this.page);
		const response = await originalGoto(url, options);
		if (new URL(this.page.url()).searchParams.has('site-slug')) {
			await this.openSavedPlayground();
		}
		await this.waitForNestedIframes();
		return response;
	}

	/**
	 * Open the URL's saved site by clicking its row, also after reload or in a popup.
	 * Calling setActiveSite() directly would bypass the behavior under test.
	 */
	async openSavedPlayground(page = this.page) {
		const slug = new URL(page.url()).searchParams.get('site-slug');
		if (!slug) throw new Error('Expected a saved-site URL');
		const escapedSlug = await page.evaluate(
			(value) => CSS.escape(value),
			slug
		);
		await page
			.getByRole('dialog', { name: 'Your Playgrounds pane' })
			.locator(`[data-playground-row="${escapedSlug}"]`)
			.getByRole('button', { name: /^Open / })
			.click();
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
		const developerTools = dock.getByRole('group', {
			name: 'Developer tools',
			includeHidden: true,
		});
		if (
			await developerTools
				.getByRole('button', { name: toolName, includeHidden: true })
				.count()
		) {
			const toggle = dock.getByRole('button', {
				name: 'Dev Tools',
				exact: true,
			});
			if ((await toggle.getAttribute('aria-expanded')) !== 'true')
				await toggle.click();
		}
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
