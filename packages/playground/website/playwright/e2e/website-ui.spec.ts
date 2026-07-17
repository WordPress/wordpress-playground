import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';
import type { Page } from '@playwright/test';

// We can't import the SupportedPHPVersions versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../../php-wasm/universal/src/lib/supported-php-versions.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

/**
 * Returns a setup URL that cannot accidentally reuse another test's autosave.
 */
function getUniqueSavedPlaygroundSetupUrl(
	label: string,
	params: Record<string, string> = {}
) {
	const searchParams = new URLSearchParams({
		name: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		...params,
	});
	return `./?${searchParams}`;
}

/**
 * Runs PHP and flushes OPFS before assertions that depend on persisted changes.
 */
async function runPHPAndFlushOpfs(page: Page, code: string) {
	await expect
		.poll(
			() =>
				page.evaluate(async (phpCode: string) => {
					try {
						const playground = (window as any).playground;
						await playground.run({ code: phpCode });
						await playground.flushOpfs('/wordpress');
						return 'ok';
					} catch (error) {
						return String(
							error instanceof Error ? error.message : error
						);
					}
				}, code),
			{ timeout: 120000 }
		)
		.toBe('ok');
}

function updateBlogNameCode(blogName: string) {
	return `<?php
require_once '/wordpress/wp-load.php';
update_option('blogname', ${JSON.stringify(blogName)});
	`;
}

/**
 * Returns the active site exposed by the site-management browser API.
 */
async function getActivePlaygroundSite(page: Page) {
	return page.evaluate(() =>
		(window as any).playgroundSites
			.list()
			.find((site: any) => site.isActive)
	);
}

async function getRunningPhpVersion(page: Page) {
	return page.evaluate(async () => {
		const playground = (window as any).playgroundSites?.getClient();
		if (!playground) {
			return undefined;
		}
		return Promise.race([
			playground
				.run({
					code: '<?php echo PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION;',
				})
				.then((response: { text: string }) => response.text),
			new Promise<undefined>((resolve) =>
				window.setTimeout(() => resolve(undefined), 1000)
			),
		]);
	});
}

async function replaceBlueprintEditorContents(
	page: Page,
	blueprint: Blueprint
) {
	// Wait for CodeMirror editor to load.
	const editor = page.locator('[class*="blueprint-editor"] .cm-editor');
	await editor.waitFor({ timeout: 10000 });

	// Focus the editor and select all existing content before replacing it.
	await editor.click();
	await page.waitForTimeout(100);
	await page.keyboard.press(
		process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
	);
	await page.keyboard.press('Backspace');
	await page.waitForTimeout(100);

	// Use Playwright's fill method on the contenteditable .cm-content element.
	// This is more reliable than character-by-character typing which triggers
	// auto-bracket insertion.
	const blueprintJson = JSON.stringify(blueprint, null, 2);
	const cmContent = editor.locator('.cm-content');
	await cmContent.fill(blueprintJson);

	// Wait for validation to complete (linter has 300ms debounce), then verify
	// the Blueprint was inserted by checking the editor content.
	await page.waitForTimeout(500);
	await expect(cmContent).toContainText('writeFile', {
		timeout: 5000,
	});
}

/**
 * Completes the real popup handshake with a same-origin test callback.
 *
 * Production intentionally does not restore GitHub tokens from localStorage,
 * so tests must enter the form through the same OAuth boundary as users.
 */
async function mockGitHubOAuth(page: Page, browserName: string) {
	if (browserName === 'firefox') {
		await page.addInitScript(() => {
			window.open = () => {
				const iframe = document.createElement('iframe');
				iframe.hidden = true;
				document.body.appendChild(iframe);
				return iframe.contentWindow;
			};
		});
	}

	await page.context().route('**/oauth.php?redirect=1*', async (route) => {
		const requestUrl = new URL(route.request().url());
		const state = requestUrl.searchParams.get('state') || '';
		await route.fulfill({
			contentType: 'text/html',
			body: `<!doctype html>
<html>
	<body>
		<script>
			(window.opener || window.parent).postMessage(
				${JSON.stringify({
					type: 'playground-github-oauth-token',
					state,
					token: 'gho_e2e_token',
				})},
				window.location.origin
			);
			window.close();
		</script>
	</body>
</html>`,
		});
	});
}

async function mockGitHubRepositoryAnalysis(page: Page) {
	// WebKit does not intercept these cross-origin requests with context.route,
	// so mock fetch before the application initializes.
	await page.addInitScript(() => {
		const originalFetch = window.fetch;
		window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
			const requestUrl =
				input instanceof Request ? input.url : String(input);
			const url = new URL(requestUrl);
			if (
				url.origin !== 'https://api.github.com' ||
				!url.pathname.startsWith('/repos/playground-test/import-source')
			) {
				return originalFetch.call(this, input, init);
			}

			let body;
			if (url.pathname === '/repos/playground-test/import-source') {
				body = { default_branch: 'trunk' };
			} else if (
				url.pathname ===
				'/repos/playground-test/import-source/branches/trunk'
			) {
				body = { commit: { sha: 'test-commit-sha' } };
			} else if (
				url.pathname === '/repos/playground-test/import-source/contents'
			) {
				body = [{ name: 'plugin.php', type: 'file' }];
			} else {
				return Promise.reject(
					new Error(`Unexpected GitHub API request: ${url}`)
				);
			}

			return Promise.resolve(
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			);
		} as typeof fetch;
	});
}

test('should reflect the URL update from the navigation bar in the WordPress site', async ({
	website,
}) => {
	await website.goto('./?storage=temp&url=/wp-admin/');
	await website.ensureSiteManagerIsClosed();
	await expect(website.page.locator('input[value="/wp-admin/"]')).toHaveValue(
		'/wp-admin/'
	);
});

test('should correctly load /wp-admin without the trailing slash', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName === 'webkit',
		'This test is flaky in WebKit. It seems like a GitHub CI issue rather than an actual flakiness since it is reliable locally.'
	);
	await website.goto('./?storage=temp&url=/wp-admin');
	await website.ensureSiteManagerIsClosed();
	await expect(website.page.locator('input[value="/wp-admin/"]')).toHaveValue(
		'/wp-admin/'
	);
});

test('should route tools through one Dock pane', async ({ website }) => {
	await website.goto('./?storage=temp');
	const dock = website.page.getByRole('navigation', {
		name: 'Playground tools',
	});
	const filesTool = dock.getByRole('button', { name: 'Files' });
	const databaseTool = dock.getByRole('button', { name: 'Database' });
	const preview = website.page.locator('[class*="site-view-content"]');

	await website.openDockPane('Files');
	await expect(filesTool).toHaveAttribute('aria-pressed', 'true');
	await expect(preview).toHaveAttribute('inert', '');
	const filesPane = website.page.getByRole('dialog', { name: 'Files pane' });
	await expect(filesPane.getByRole('tabpanel')).toHaveCount(0);
	await expect(filesPane.getByLabel('Playground title')).toHaveCount(0);

	await website.openDockPane('Database');
	await expect(filesTool).toHaveAttribute('aria-pressed', 'false');
	await expect(databaseTool).toHaveAttribute('aria-pressed', 'true');
	await expect(
		website.page.getByRole('dialog', { name: 'Database pane' })
	).toBeFocused();
	await expect(
		website.page.getByRole('dialog', { name: 'Files pane' })
	).not.toBeVisible();

	await databaseTool.click();
	await expect(
		website.page.getByRole('dialog', { name: 'Database pane' })
	).not.toBeVisible();
	await expect(preview).not.toHaveAttribute('inert', '');
	await expect(databaseTool).toBeFocused();
});

test('should keep the whole Dock pane visible while it closes', async ({
	website,
}) => {
	await website.page.goto('./?storage=temp');
	await website.openDockPane('Your Playgrounds');
	const pane = website.page.locator(
		'section[aria-label="Your Playgrounds pane"]'
	);
	await expect(pane).toHaveCSS('opacity', '1');

	const { openHeight, closingHeight } = await pane.evaluate(
		async (element) => {
			const activeTool = document.querySelector<HTMLButtonElement>(
				'nav[aria-label="Playground tools"] button[aria-pressed="true"]'
			);
			if (!activeTool) {
				throw new Error('The active Dock tool was not found');
			}

			const openHeight = element.getBoundingClientRect().height;
			// Sample when CSSTransition changes classes. On a busy CI worker, an
			// animation frame can run after the 240ms exit timeout has elapsed.
			const closingHeight = await new Promise<number>((resolve) => {
				const observer = new MutationObserver(() => {
					observer.disconnect();
					resolve(element.getBoundingClientRect().height);
				});
				observer.observe(element, {
					attributes: true,
					attributeFilter: ['class'],
				});
				activeTool.click();
			});
			return {
				openHeight,
				closingHeight,
			};
		}
	);

	expect(Math.abs(closingHeight - openHeight)).toBeLessThanOrEqual(1);
	await expect(pane).not.toBeVisible();
});

test('should keep a settings draft across Dock destinations and close', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.openDockPane('Site Settings');
	const networking = website.page.getByLabel('Network access');
	await expect(networking).toBeChecked();
	await networking.uncheck();

	await website.openDockPane('Database');
	await expect(networking).not.toBeVisible();
	await website.openDockPane('Site Settings');
	await expect(networking).not.toBeChecked();

	await website.page.keyboard.press('Escape');
	await expect(networking).not.toBeVisible();
	await website.openDockPane('Site Settings');
	await expect(networking).not.toBeChecked();
});

test('should offer only the destructive fresh-site action for a temporary Playground', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.openDockPane('Site Settings');
	const pane = website.page.getByRole('dialog', {
		name: 'Site Settings pane',
	});
	await expect(
		pane.getByRole('button', {
			name: 'Discard current work & create a fresh Playground',
		})
	).toBeVisible();
	await expect(
		pane.getByRole('button', { name: 'More settings actions' })
	).toHaveCount(0);
	await expect(
		pane.getByRole('button', { name: 'Apply to this Playground' })
	).toHaveCount(0);
});

test('should keep the selected New method and its draft across Dock destinations', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.openDockPane('New Playground');
	const newPane = website.page.getByRole('dialog', {
		name: 'New Playground pane',
	});
	const blueprintUrlTab = newPane.locator('#creation-tab-blueprint-url');
	await blueprintUrlTab.click();
	const blueprintUrl = newPane.getByRole('textbox', {
		name: 'Blueprint URL',
	});
	await blueprintUrl.fill('https://example.com/in-progress-blueprint.json');

	await website.openDockPane('Database');
	await expect(newPane).not.toBeVisible();
	await website.openDockPane('New Playground');
	await expect(blueprintUrlTab).toHaveAttribute('aria-selected', 'true');
	await expect(blueprintUrl).toHaveValue(
		'https://example.com/in-progress-blueprint.json'
	);

	await website.page.keyboard.press('Escape');
	await website.openDockPane('New Playground');
	await expect(blueprintUrlTab).toHaveAttribute('aria-selected', 'true');
	await expect(blueprintUrl).toHaveValue(
		'https://example.com/in-progress-blueprint.json'
	);
});

test('should keep Export feedback across Dock destinations', async ({
	website,
	context,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		'Firefox and WebKit do not support clipboard permissions through Playwright.'
	);
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await website.goto('./?storage=temp');
	await website.openDockPane('Export');
	const exportPane = website.page.getByRole('dialog', {
		name: 'Export pane',
	});
	await exportPane.getByRole('button', { name: 'Copy link' }).click();
	await expect(
		exportPane.getByText('Setup URL copied to the clipboard.')
	).toBeVisible();

	await website.openDockPane('Database');
	await expect(exportPane).not.toBeVisible();
	await website.openDockPane('Export');
	await expect(
		exportPane.getByRole('button', { name: 'Link copied' })
	).toBeVisible();
	await expect(
		exportPane.getByText('Setup URL copied to the clipboard.')
	).toBeVisible();
});

test('should open and clear Blueprint gallery deep links at every viewport size', async ({
	website,
}) => {
	for (const width of [1280, 390]) {
		await website.page.setViewportSize({ width, height: 844 });
		await website.goto('./?overlay=blueprints');
		const pane = website.page.getByRole('dialog', {
			name: 'New Playground pane',
		});
		await expect(pane).toBeVisible();
		await expect(
			pane.getByRole('heading', { name: 'Start from a Blueprint' })
		).toBeVisible();

		await website.page.keyboard.press('Escape');
		await expect(pane).not.toBeVisible();
		expect(new URL(website.page.url()).searchParams.has('overlay')).toBe(
			false
		);
	}
});

test('should switch the desktop Dock between full width and collapsed states', async ({
	website,
	browserName,
}) => {
	await website.goto('./?storage=temp');
	const dock = website.page.getByRole('navigation', {
		name: 'Playground tools',
	});
	const initialBounds = await dock.boundingBox();
	expect(initialBounds).not.toBeNull();

	await dock.getByRole('button', { name: 'Full width' }).click();
	await expect(website.page.locator('html')).toHaveAttribute(
		'data-dock-full-width',
		''
	);
	await dock.getByRole('button', { name: 'Exit full width' }).click();
	await expect(website.page.locator('html')).not.toHaveAttribute(
		'data-dock-full-width',
		''
	);

	await dock.getByRole('button', { name: 'Hide tools' }).click();
	await expect(
		dock.getByRole('button', { name: 'Show tools' })
	).toBeVisible();
	await expect(
		dock.getByRole('button', { name: 'New Playground' })
	).not.toBeVisible();
	await expect(dock.getByRole('combobox')).toBeVisible();
	await expect
		.poll(async () => (await dock.boundingBox())?.y)
		.toBeGreaterThan(initialBounds!.y);
	if (browserName === 'chromium') {
		await dock.getByRole('button', { name: 'Unsaved' }).click();
		await expect(
			website.page.locator('section[aria-label="Store permanently pane"]')
		).toBeVisible();
		await expect(
			dock.getByRole('button', { name: 'Show tools' })
		).toBeVisible();
		await expect(
			dock.getByRole('button', { name: 'New Playground' })
		).not.toBeVisible();
		await website.page
			.locator('section[aria-label="Store permanently pane"]')
			.getByRole('button', { name: 'Cancel' })
			.click();
	}

	await dock.getByRole('button', { name: 'Show tools' }).click();
	await expect(
		dock.getByRole('button', { name: 'New Playground' })
	).toBeVisible();
});

test('should fold and restore the desktop Dock without hiding an open pane', async ({
	website,
}) => {
	await website.page.emulateMedia({ reducedMotion: 'reduce' });
	await website.goto('./?storage=temp');
	const dock = website.page.getByRole('navigation', {
		name: 'Playground tools',
	});
	const initialBounds = await dock.boundingBox();
	expect(initialBounds).not.toBeNull();

	await dragDockPastLeftEdge();
	const launcher = website.page.getByRole('button', {
		name: 'Show Playground tools',
	});
	await expect(launcher).toBeVisible();
	await expect(dock).not.toBeVisible();

	await launcher.click();
	await expect(dock).toBeVisible();
	await expect(launcher).toHaveCount(0);
	const restoredBounds = await dock.boundingBox();
	expect(restoredBounds).not.toBeNull();
	expect(Math.abs(restoredBounds!.x - initialBounds!.x)).toBeLessThan(3);

	await website.openDockPane('Files');
	await dragDockPastLeftEdge();
	await expect(
		website.page.getByRole('dialog', { name: 'Files pane' })
	).toBeVisible();
	await expect(dock).toBeVisible();
	await expect(launcher).toHaveCount(0);

	async function dragDockPastLeftEdge() {
		const bounds = await dock.boundingBox();
		expect(bounds).not.toBeNull();
		const startX = bounds!.x + bounds!.width / 2;
		const endX = -bounds!.width;
		await dock.dispatchEvent('pointerdown', {
			bubbles: true,
			button: 0,
			buttons: 1,
			clientX: startX,
			isPrimary: true,
			pointerId: 1,
		});
		await website.page.evaluate((clientX) => {
			window.dispatchEvent(
				new PointerEvent('pointermove', {
					bubbles: true,
					button: 0,
					buttons: 1,
					clientX,
					isPrimary: true,
					pointerId: 1,
				})
			);
			window.dispatchEvent(
				new PointerEvent('pointerup', {
					bubbles: true,
					button: 0,
					clientX,
					isPrimary: true,
					pointerId: 1,
				})
			);
		}, endX);
	}
});

SupportedPHPVersions.forEach(async (version) => {
	test(`should switch PHP version to ${version}`, async ({ website }) => {
		await website.goto('./?storage=temp');
		await website.ensureSiteManagerIsOpen();
		await website.page.getByLabel('PHP version').selectOption(version);
		await website.page
			.getByText('Discard current work & create a fresh Playground')
			.click();
		await website.ensureSiteManagerIsClosed();
		await website.ensureSiteManagerIsOpen();

		await expect(website.page.getByLabel('PHP version')).toHaveValue(
			version
		);
	});
});

Object.keys(MinifiedWordPressVersions)
	// WordPress beta versions are not supported in the UI
	.filter((version) => !['beta', 'default'].includes(version))
	.forEach(async (version) => {
		test(`should switch WordPress version to ${version}`, async ({
			website,
		}) => {
			await website.goto('./?storage=temp');
			await website.ensureSiteManagerIsOpen();
			await website.page
				.getByLabel('WordPress version')
				.selectOption(version);
			await website.page
				.getByText('Discard current work & create a fresh Playground')
				.click();
			await website.ensureSiteManagerIsClosed();
			await website.ensureSiteManagerIsOpen();

			await expect(
				website.page.getByLabel('WordPress version')
			).toHaveValue(version);
		});
	});

test('should display networking as active by default', async ({ website }) => {
	await website.goto('./?storage=temp');
	await website.ensureSiteManagerIsOpen();
	await expect(website.page.getByLabel('Network access')).toBeChecked();
});

test('should display networking as active when networking is enabled', async ({
	website,
}) => {
	await website.goto('./?storage=temp&networking=yes');
	await website.ensureSiteManagerIsOpen();
	await expect(website.page.getByLabel('Network access')).toBeChecked();
});

test('should enable networking when requested', async ({ website }) => {
	await website.goto('./?storage=temp');

	await website.ensureSiteManagerIsOpen();
	await website.page.getByLabel('Network access').check();
	await website.page
		.getByText('Discard current work & create a fresh Playground')
		.click();
	await website.ensureSiteManagerIsClosed();
	await website.ensureSiteManagerIsOpen();

	await expect(website.page.getByLabel('Network access')).toBeChecked();
});

test('should disable networking when requested', async ({ website }) => {
	await website.goto('./?storage=temp&networking=yes');

	await website.ensureSiteManagerIsOpen();
	await website.page.getByLabel('Network access').uncheck();
	await website.page
		.getByText('Discard current work & create a fresh Playground')
		.click();
	await website.ensureSiteManagerIsClosed();
	await website.ensureSiteManagerIsOpen();

	await expect(website.page.getByLabel('Network access')).not.toBeChecked();
});

test('should display PHP output even when a fatal error is hit', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/err.php',
		login: true,
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/err.php',
				data: "<?php throw new Exception('This is a fatal error'); \n",
			},
		],
	};
	await website.goto(`./?storage=temp#${JSON.stringify(blueprint)}`);

	await expect(wordpress.locator('body')).toContainText(
		'This is a fatal error'
	);
});

test('should keep query arguments when updating settings', async ({
	website,
	wordpress,
}) => {
	await website.goto(
		'./?storage=temp&url=/wp-admin/&php=8.0&wp=6.6&networking=no'
	);

	const initialParams = new URL(website.page.url()).searchParams;
	expect(initialParams.get('storage')).toBe('temp');
	expect(initialParams.get('url')).toBe('/wp-admin/');
	expect(initialParams.get('php')).toBe('8.0');
	expect(initialParams.get('wp')).toBe('6.6');
	expect(initialParams.get('networking')).toBe('no');
	expect(
		await wordpress.locator('body').evaluate((body) => body.baseURI)
	).toMatch('/wp-admin/');

	await website.ensureSiteManagerIsOpen();
	await website.page.getByLabel('Network access').check();
	await website.page
		.getByText('Discard current work & create a fresh Playground')
		.click();
	await website.waitForNestedIframes();

	const updatedParams = new URL(website.page.url()).searchParams;
	expect(updatedParams.get('storage')).toBe('temp');
	expect(updatedParams.get('url')).toBe('/wp-admin/');
	expect(updatedParams.get('php')).toBe('8.0');
	expect(updatedParams.get('wp')).toBe('6.6');
	expect(updatedParams.get('networking')).toBe('yes');
	expect(
		await wordpress.locator('body').evaluate((body) => body.baseURI)
	).toMatch('/wp-admin/');
});

test('should edit a file on mobile and see changes in the viewport', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?storage=temp');
	await website.page.setViewportSize({ width: 375, height: 812 });

	await website.openDockPane('Files');
	const filesPane = website.page.getByRole('dialog', { name: 'Files pane' });
	await filesPane.getByRole('button', { name: 'Browse files' }).click();

	// Wait for file tree to load
	await website.page.locator('[data-path="/wordpress"]').waitFor();

	// Expand /wordpress folder
	const wordpressFolder = website.page.locator(
		'button[data-path="/wordpress"]'
	);
	if ((await wordpressFolder.getAttribute('data-expanded')) !== 'true') {
		await wordpressFolder.click();
	}

	// Double-click index.php to open it in the editor
	await website.page
		.locator('button[data-path="/wordpress/index.php"]')
		.dblclick();

	// Wait for CodeMirror editor to load
	const editor = website.page.locator('[class*="file-browser"] .cm-editor');
	await editor.waitFor({ timeout: 10000 });
	const saveButton = filesPane.getByRole('button', {
		name: /^(Save|Saved|Saving…)$/,
	});

	// Click on the editor to focus it
	await website.page.waitForTimeout(50);

	await editor.click();

	await website.page.waitForTimeout(250);

	// Select all content in the editor (Cmd+A or Ctrl+A)
	await website.page.keyboard.press(
		process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
	);

	await website.page.keyboard.press('Backspace');
	await website.page.waitForTimeout(200);

	// Type the new content with a delay between keystrokes
	await website.page.keyboard.type('Edited file', { delay: 50 });

	await expect(saveButton).toBeEnabled();

	// Save immediately instead of waiting for the autosave debounce.
	await saveButton.click();
	await expect(saveButton).toHaveText('Saved');
	await expect(filesPane.getByRole('status')).toHaveText(
		'All changes saved.'
	);
	await expect(saveButton).toBeEnabled();
	await expect(saveButton).toHaveText('Save');

	// Close the site manager to see the viewport
	await website.ensureSiteManagerIsClosed();

	// Reload just the WordPress iframe to see the changes
	const playgroundViewport = website.page.frameLocator(
		'#playground-viewport:visible,.playground-viewport:visible'
	);
	await playgroundViewport
		.locator('#wp')
		.evaluate((iframe: HTMLIFrameElement) => {
			iframe.contentWindow?.location.reload();
		});

	// Verify the page shows "Edited file"
	await expect(wordpress.locator('body')).toContainText('Edited file', {
		timeout: 10000,
	});
});

test('should edit a blueprint in the blueprint editor and recreate the playground', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?storage=temp');

	await website.openDockPane('Current Blueprint', 'Blueprint pane');
	await expect(
		website.page.getByRole('button', { name: 'Create new file' })
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: 'Create new folder' })
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: 'Upload files' })
	).toBeVisible();

	// Create a simple blueprint that writes "Blueprint test" to index.php
	const blueprint: Blueprint = {
		landingPage: '/index.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/index.php',
				data: 'Blueprint test',
			},
		],
	};
	await replaceBlueprintEditorContents(website.page, blueprint);

	// Click the "Run Blueprint" button
	await website.page
		.getByRole('button', {
			name: 'Run Blueprint',
		})
		.click();

	await website.page.waitForTimeout(1500);
	// Wait for the playground to recreate
	await website.waitForNestedIframes();

	// Verify the page shows "Blueprint test"
	await expect(wordpress.locator('body')).toContainText('Blueprint test', {
		timeout: 10000,
	});
});

test('should keep the last Blueprint edit when its Dock pane closes', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.openDockPane('Current Blueprint', 'Blueprint pane');
	await replaceBlueprintEditorContents(website.page, {
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/close-flush.txt',
				data: 'Saved before close',
			},
		],
	});
	await website.page.keyboard.press('Escape');
	await expect(
		website.page.getByRole('dialog', { name: 'Blueprint pane' })
	).not.toBeVisible();

	await website.openDockPane('Current Blueprint', 'Blueprint pane');
	await expect(
		website.page.locator('[class*="blueprint-editor"] .cm-content')
	).toContainText('Saved before close');
});

test('should copy blueprint link to clipboard when share button is clicked', async ({
	website,
	context,
	browserName,
}) => {
	test.skip(
		browserName === 'firefox' || browserName === 'webkit',
		'Firefox and WebKit do not support clipboard permissions through Playwright'
	);

	// Grant clipboard permissions
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);

	await website.goto('./?storage=temp');

	await website.openDockPane('Current Blueprint', 'Blueprint pane');

	// Wait for CodeMirror editor to load
	const editor = website.page.locator(
		'[class*="blueprint-editor"] .cm-editor'
	);
	await editor.waitFor({ timeout: 10000 });

	// Wait for the URL hash to be computed (debounced by 500ms in the component)
	// and the share button to be ready
	await website.page.waitForTimeout(1000);

	// Copy the Blueprint URL from the editor's Export menu.
	await website.page
		.getByRole('dialog', { name: 'Blueprint pane' })
		.getByRole('button', { name: 'Export' })
		.click();
	await website.page
		.getByRole('menuitem', { name: 'Copy Blueprint URL' })
		.click();

	// Verify success message appears in the notice component
	await expect(
		website.page
			.locator('.components-notice')
			.getByText('Link copied to clipboard!')
	).toBeVisible();

	// Verify clipboard contains the correct URL format
	const clipboardContent = await website.page.evaluate(() =>
		navigator.clipboard.readText()
	);
	// URL format: http(s)://host/optional-path/#base64
	expect(clipboardContent).toMatch(/^https?:\/\/[^#]+#[A-Za-z0-9+/=]+$/);

	// Verify the base64 portion decodes to valid JSON
	const base64Part = clipboardContent.split('#')[1];
	const decodedBlueprint = JSON.parse(
		new TextDecoder().decode(
			Uint8Array.from(atob(base64Part), (c) => c.charCodeAt(0))
		)
	);
	expect(decodedBlueprint).toHaveProperty('steps');
	expect(Array.isArray(decodedBlueprint.steps)).toBe(true);
});

test('should make every Dock tool reachable on mobile', async ({ website }) => {
	await website.page.setViewportSize({ width: 390, height: 844 });
	await website.goto('./');
	const dock = website.page.getByRole('navigation', {
		name: 'Playground tools',
	});
	const destinations = [
		['New Playground', 'New Playground pane'],
		['Your Playgrounds', 'Your Playgrounds pane'],
		['Current Blueprint', 'Blueprint pane'],
		['Site Settings', 'Site Settings pane'],
		['Database', 'Database pane'],
		['Files', 'Files pane'],
		['Logs', 'Logs pane'],
		['Export', 'Export pane'],
	] as const;

	for (const [toolName, paneName] of destinations) {
		await website.openDockPane(toolName, paneName);
		const pane = website.page.getByRole('dialog', { name: paneName });
		await expect(pane).toBeVisible();
		await expect(pane.getByRole('button', { name: 'Close' })).toBeVisible();
	}

	await expect(
		dock.getByRole('button', { name: 'Hide tools' })
	).toBeVisible();
	await expect(dock.getByRole('button', { name: 'Full width' })).toHaveCount(
		0
	);
	await expect(
		website.page.getByRole('dialog', { name: 'Export pane' })
	).toBeFocused();
	const exportPane = website.page.getByRole('dialog', {
		name: 'Export pane',
	});
	const preview = website.page.locator('[class*="site-view-content"]');
	await exportPane.getByRole('button', { name: 'Close' }).click();
	await expect(exportPane).not.toBeVisible();
	await expect(preview).not.toHaveAttribute('inert', /.*/);
	await expect(dock.getByRole('button', { name: 'Export' })).toBeFocused();

	await dock.getByRole('button', { name: 'Hide tools' }).click();
	await expect(
		dock.getByRole('button', { name: 'Show tools' })
	).toBeVisible();
	await expect(
		dock.getByRole('button', { name: 'New Playground' })
	).not.toBeVisible();
	await expect(dock.getByRole('combobox')).toBeVisible();
	await dock.getByRole('button', { name: 'Show tools' }).click();
	await expect(
		dock.getByRole('button', { name: 'New Playground' })
	).toBeVisible();

	await website.page.setViewportSize({ width: 320, height: 700 });
	await website.openDockPane('Site Settings');
	const siteDetailsPane = website.page.getByRole('dialog', {
		name: 'Site Settings pane',
	});
	const closeBounds = await siteDetailsPane
		.getByRole('button', { name: 'Close' })
		.boundingBox();
	expect(closeBounds).not.toBeNull();

	const previewBounds = await preview.boundingBox();
	const dockBounds = await dock.boundingBox();
	expect(previewBounds).not.toBeNull();
	expect(dockBounds).not.toBeNull();
	expect(previewBounds!.y + previewBounds!.height).toBeLessThanOrEqual(
		dockBounds!.y + 1
	);
});

test('should stat the database size without reading the database into JavaScript', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.waitForNestedIframes();
	await website.page.waitForFunction(
		() => Boolean((window as any).playgroundSites?.getClient()),
		undefined,
		{ timeout: 120000 }
	);
	await website.page.evaluate(() => {
		const playground = (window as any).playgroundSites.getClient();
		const originalRead = playground.readFileAsBuffer.bind(playground);
		(window as any).__databaseReadCount = 0;
		playground.readFileAsBuffer = async (path: string) => {
			if (path.endsWith('/wp-content/database/.ht.sqlite')) {
				(window as any).__databaseReadCount++;
				throw new Error(
					'Database contents must not be read to calculate size.'
				);
			}
			return originalRead(path);
		};
	});

	await website.openDockPane('Database');
	const sizeValue = website.page
		.getByText('Size:')
		.locator('xpath=following-sibling::dd[1]');
	await expect(sizeValue).toHaveText(/^\d+(?:\.\d+)? (?:B|KB|MB|GB)$/);
	expect(
		await website.page.evaluate(() => (window as any).__databaseReadCount)
	).toBe(0);
});

test.describe('Database panel', () => {
	test.beforeEach(async ({ website }) => {
		await website.goto('./?storage=temp');
		await website.openDockPane('Database');
	});

	test('should display database info', async ({ website }) => {
		await expect(website.page.getByText('Path:')).toBeVisible();
		await expect(
			website.page.getByText('/wordpress/wp-content/database/.ht.sqlite')
		).toBeVisible();
		await expect(website.page.getByText('Size:')).toBeVisible();
	});

	test('should download database file when Download button is clicked', async ({
		website,
	}) => {
		const downloadButton = website.page.getByRole('button', {
			name: /Download database/i,
		});
		await expect(downloadButton).toBeVisible();
		await expect(downloadButton).toBeEnabled();

		// Set up download listener
		const downloadPromise = website.page.waitForEvent('download');

		// Click the download button
		await downloadButton.click();

		// Verify the download
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe('database.sqlite');
		const path = await download.path();
		expect(path).toBeTruthy();
	});

	test('should load and open Adminer', async ({ website, context }) => {
		const adminerButton = website.page.getByRole('button', {
			name: 'Open Adminer',
		});
		await expect(adminerButton).toBeVisible();
		await expect(adminerButton).toBeEnabled();

		// Set up new page listener
		const pagePromise = context.waitForEvent('page');

		// Click the Adminer button
		await adminerButton.click();

		// Verify Adminer opened in new tab
		const newPage = await pagePromise;
		await newPage.waitForLoadState();
		expect(newPage.url()).toContain('/adminer/');
		await expect(newPage.locator('body')).toContainText('Adminer');
		await expect(newPage.locator('body')).toContainText('wp_posts');

		// Browse the "wp_posts" table
		await newPage
			.locator('#tables a.structure[title="Show structure"]')
			.filter({ hasText: 'wp_posts' })
			.click();
		await newPage.waitForLoadState();
		await newPage.getByRole('link', { name: 'select data' }).click();
		await newPage.waitForLoadState();
		const adminerRows = newPage.locator('table.checkable tbody tr');
		await expect(adminerRows.first()).toContainText(
			'Welcome to WordPress.'
		);

		// Click "edit" on a row
		await adminerRows.first().getByRole('link', { name: 'edit' }).click();
		await newPage.waitForLoadState();
		await expect(newPage.locator('form#form')).toBeVisible();
		await expect(newPage.locator('form#form')).toContainText(
			'Welcome to WordPress.'
		);

		// Update the post content
		const postContentTextarea = newPage.locator(
			'textarea[name="fields[post_content]"]'
		);
		await postContentTextarea.click();
		await postContentTextarea.clear();
		await postContentTextarea.fill('Updated post content.');
		await newPage
			.getByRole('button', { name: 'Save', exact: true })
			.click();
		await newPage.waitForLoadState();

		// Go back row listing and verify the updated content
		await newPage.getByRole('link', { name: 'Select data' }).click();
		await newPage.waitForLoadState();
		await expect(
			newPage.locator('table.checkable tbody tr').first()
		).toContainText('Updated post content.');

		// Go to SQL tab and execute "SHOW TABLES"
		await newPage.getByRole('link', { name: 'SQL command' }).click();
		await newPage.waitForLoadState();
		const sqlTextarea = newPage.locator('textarea[name="query"]');
		await sqlTextarea.fill('SHOW TABLES', { force: true });
		await newPage.getByRole('button', { name: 'Execute' }).click();
		await newPage.waitForLoadState();
		await expect(newPage.locator('body')).toContainText('wp_posts');

		await newPage.close();
	});

	test('should load and open phpMyAdmin', async ({ website, context }) => {
		const phpMyAdminButton = website.page.getByRole('button', {
			name: 'Open phpMyAdmin',
		});
		await expect(phpMyAdminButton).toBeVisible();
		await expect(phpMyAdminButton).toBeEnabled();

		// Set up new page listener
		const pagePromise = context.waitForEvent('page');

		// Click the phpMyAdmin button
		await phpMyAdminButton.click();

		// Verify phpMyAdmin opened in new tab
		const newPage = await pagePromise;
		await newPage.waitForLoadState();
		expect(newPage.url()).toContain('/phpmyadmin');
		await expect(newPage.locator('body')).toContainText('phpMyAdmin');
		await expect(newPage.locator('body')).toContainText('wp_posts');

		/*
		 * Before clicking a link in phpMyAdmin, we need to wait for any AJAX
		 * requests to be done. This prevents flaky tests (mainly in Firefox).
		 *
		 * @see https://github.com/phpmyadmin/phpmyadmin/blob/3925c2237701050ee34f5ba79d74fda808673d4f/resources/js/modules/ajax.ts
		 */
		const waitForAjaxIdle = async () =>
			newPage.waitForFunction(() => {
				return (window as any).AJAX?.active === false;
			});

		// Browse the "wp_posts" table
		const wpPostsRow = newPage
			.locator('tr')
			.filter({ hasText: 'wp_posts' })
			.first();
		await expect(wpPostsRow).toBeVisible();
		await waitForAjaxIdle();
		await wpPostsRow.getByRole('link', { name: 'Browse' }).click();
		await newPage.waitForLoadState();
		const pmaRows = newPage.locator('table.table_results tbody tr');
		await expect(pmaRows.first()).toContainText('Welcome to WordPress.');

		// Click "edit" on a row
		await waitForAjaxIdle();
		await pmaRows
			.first()
			.getByRole('link', { name: 'Edit' })
			.first()
			.click();
		await newPage.waitForLoadState();
		const editForm = newPage.locator('form#insertForm');
		await expect(editForm).toBeVisible();
		await expect(editForm).toContainText('Welcome to WordPress.');

		// Update the post content
		const postContentRow = editForm
			.locator('tr')
			.filter({ hasText: 'post_content' })
			.first();
		const postContentTextarea = postContentRow.locator('textarea').first();
		await postContentTextarea.click();
		await postContentTextarea.clear();
		await postContentTextarea.fill('Updated post content.');
		await newPage.getByRole('button', { name: 'Go' }).first().click();

		// Verify the updated content
		await newPage.waitForLoadState();
		await expect(
			newPage.locator('table.table_results tbody tr').first()
		).toContainText('Updated post content.');

		// Go to SQL tab and execute "SHOW TABLES"
		await newPage
			.locator('#topmenu')
			.getByRole('link', { name: 'SQL' })
			.click();
		await newPage.waitForLoadState();
		await newPage.locator('.CodeMirror.cm-s-default').click();
		await newPage.keyboard.type('SHOW TABLES');
		await newPage.getByRole('button', { name: 'Go' }).click();
		await newPage.waitForLoadState();
		await expect(newPage.locator('body')).toContainText('wp_posts');

		await newPage.close();
	});
});

// Test browser-saved Playgrounds by default and explicit temporary opt-outs.
test.describe('Default Playground storage', () => {
	test.describe.configure({ mode: 'serial' });

	test('should create and finish autosaving a Playground from the root URL', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.page.addInitScript(() => {
			(window as any).__saveStatusSamples = [];
			let installed = false;
			const sampleStatus = () => {
				const statusAnnouncement = [
					...document.querySelectorAll('[role="status"]'),
				]
					.map((node) => (node.textContent || '').trim())
					.find((text) =>
						[
							'Save complete',
							'Autosave complete',
							'Save failed',
							'Autosave failed',
						].includes(text)
					);
				const statusButton = [
					...document.querySelectorAll(
						'[role="progressbar"], button'
					),
				].find((node) => {
					const label = (node.textContent || '').trim();
					return (
						label === 'Autosaving' ||
						label === 'Saving' ||
						label === 'Autosaved' ||
						label === 'Saved' ||
						label === 'Unsaved'
					);
				});
				if (!statusButton) {
					return;
				}
				(window as any).__saveStatusSamples.push({
					text: (statusButton.textContent || '').trim(),
					role: statusButton.getAttribute('role'),
					ariaLabel: statusButton.getAttribute('aria-label'),
					ariaValueNow: statusButton.getAttribute('aria-valuenow'),
					statusAnnouncement: statusAnnouncement ?? null,
					color: getComputedStyle(statusButton).color,
				});
			};
			const installObserver = () => {
				if (installed) {
					return;
				}
				if (!document.documentElement) {
					requestAnimationFrame(installObserver);
					return;
				}
				installed = true;
				new MutationObserver(sampleStatus).observe(
					document.documentElement,
					{
						attributes: true,
						characterData: true,
						childList: true,
						subtree: true,
					}
				);
				window.setInterval(sampleStatus, 25);
				sampleStatus();
			};
			installObserver();
		});
		await website.page.goto('./');
		await expect(
			website.page.getByRole('navigation', {
				name: 'Playground tools',
			})
		).toBeVisible();
		await website.ensureSiteManagerIsClosed();

		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({
			timeout: 120000,
		});
		expect(new URL(website.page.url()).searchParams.get('site-slug')).toBe(
			null
		);
		await expect(website.page.getByText('Autosaving')).toHaveCount(0);
		await expect(website.page.getByText('Finalizing autosave')).toHaveCount(
			0
		);
		await expect(
			website.page.getByRole('button', { name: 'Unsaved' })
		).toHaveCount(0);
		const saveStatusSamples = await website.page.evaluate(() =>
			((window as any).__saveStatusSamples || []).filter(
				(
					sample: {
						text: string;
						role: string | null;
						ariaLabel: string | null;
						ariaValueNow: string | null;
						statusAnnouncement: string | null;
						color: string;
					},
					index: number,
					all: {
						text: string;
						role: string | null;
						ariaLabel: string | null;
						ariaValueNow: string | null;
						statusAnnouncement: string | null;
						color: string;
					}[]
				) => {
					const previous = all[index - 1];
					return (
						!previous ||
						previous.text !== sample.text ||
						previous.role !== sample.role ||
						previous.ariaLabel !== sample.ariaLabel ||
						previous.ariaValueNow !== sample.ariaValueNow ||
						previous.statusAnnouncement !==
							sample.statusAnnouncement ||
						previous.color !== sample.color
					);
				}
			)
		);
		expect(saveStatusSamples.some(({ text }) => text === 'Autosaved')).toBe(
			true
		);
		expect(
			saveStatusSamples.some(({ text }) => text === 'Autosaving')
		).toBe(false);
		const progressbarSamples = saveStatusSamples.filter(
			({ role }) => role === 'progressbar'
		);
		expect(progressbarSamples.length).toBeGreaterThan(0);
		expect(
			progressbarSamples.every(
				({ ariaLabel }) => ariaLabel === 'Autosave progress'
			)
		).toBe(true);
		expect(
			progressbarSamples.some(({ ariaValueNow }) =>
				/^[1-9]\d*$/.test(ariaValueNow ?? '')
			)
		).toBe(true);
		expect(
			saveStatusSamples.some(
				({ statusAnnouncement }) =>
					statusAnnouncement === 'Autosave complete'
			)
		).toBe(true);
		expect(
			saveStatusSamples.some(({ statusAnnouncement }) =>
				/\d+%/.test(statusAnnouncement ?? '')
			)
		).toBe(false);
	});

	test('should edit a Blueprint for an autosaved Playground and run it in a new Playground', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(getUniqueSavedPlaygroundSetupUrl('blueprint-edit'));
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const originalSite = await getActivePlaygroundSite(website.page);
		await runPHPAndFlushOpfs(
			website.page,
			"<?php file_put_contents('/wordpress/index.php', 'Original autosaved Playground');"
		);

		await website.openDockPane('Current Blueprint', 'Blueprint pane');
		await expect(
			website.page
				.getByLabel('WordPress Playground')
				.getByText(
					`Running this Blueprint creates a fresh autosaved Playground. “${originalSite.name}” stays in Recent autosaves.`
				)
		).toBeVisible();

		const editedBlueprint = {
			landingPage: '/index.php',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/index.php',
					data: 'Autosaved Blueprint test',
				},
			],
		} satisfies Blueprint;
		const blueprintContents = website.page.locator(
			'[class*="blueprint-editor"] .cm-content'
		);
		await blueprintContents.fill(JSON.stringify(editedBlueprint, null, 2));
		await website.page.keyboard.press('Escape');
		await website.openDockPane('Current Blueprint', 'Blueprint pane');
		await expect(
			website.page.locator('[class*="blueprint-editor"] .cm-content')
		).toContainText('Autosaved Blueprint test');

		await website.page
			.getByRole('button', { name: 'Run in a new Playground' })
			.click();

		await expect(
			website.page.getByRole('dialog', { name: 'Blueprint pane' })
		).not.toBeVisible({ timeout: 120000 });
		await website.waitForNestedIframes();
		await expect(wordpress.locator('body')).toContainText(
			'Autosaved Blueprint test',
			{ timeout: 120000 }
		);
		const newSite = await getActivePlaygroundSite(website.page);
		expect(newSite).toMatchObject({ persistence: 'autosave' });
		expect(newSite.slug).not.toBe(originalSite.slug);
		await expect
			.poll(
				() =>
					website.page.evaluate(
						(slug) =>
							(window as any).playgroundSites
								.list()
								.some((site: any) => site.slug === slug),
						originalSite.slug
					),
				{ timeout: 120000 }
			)
			.toBe(true);

		await website.page.evaluate((slug) => {
			return (window as any).playgroundSites.setActiveSite(slug);
		}, originalSite.slug);
		await website.waitForNestedIframes();
		await expect(wordpress.locator('body')).toContainText(
			'Original autosaved Playground',
			{ timeout: 120000 }
		);
		await expect(wordpress.locator('body')).not.toContainText(
			'Autosaved Blueprint test'
		);
		await website.openDockPane('Current Blueprint', 'Blueprint pane');
		await expect(
			website.page.locator('[class*="blueprint-editor"] .cm-content')
		).toContainText('Autosaved Blueprint test');
	});

	test('should edit a Blueprint for a saved Playground and run it in a new Playground', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(browserName !== 'chromium', 'This test requires OPFS.');

		await website.goto(
			getUniqueSavedPlaygroundSetupUrl('saved-blueprint-edit')
		);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		await website.page.getByRole('button', { name: 'Autosaved' }).click();
		const savePane = website.page.locator(
			'section[aria-label="Store permanently pane"]'
		);
		await savePane.getByRole('button', { name: 'Save' }).click();
		await expect(savePane).not.toBeVisible({ timeout: 120000 });
		await expect(
			website.page.getByText('Saved', { exact: true })
		).toBeVisible();
		const savedSite = await getActivePlaygroundSite(website.page);

		await website.openDockPane('Current Blueprint', 'Blueprint pane');
		await expect(
			website.page.getByText(/This Blueprint is read-only/)
		).toHaveCount(0);
		const editedBlueprint = {
			landingPage: '/index.php',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/index.php',
					data: 'Saved Blueprint test',
				},
			],
		} satisfies Blueprint;
		const blueprintContents = website.page.locator(
			'[class*="blueprint-editor"] .cm-content'
		);
		await expect(blueprintContents).toHaveAttribute(
			'contenteditable',
			'true'
		);
		await blueprintContents.fill(JSON.stringify(editedBlueprint, null, 2));
		await website.page
			.getByRole('button', { name: 'Run in a new Playground' })
			.click();

		await expect(
			website.page.getByRole('dialog', { name: 'Blueprint pane' })
		).not.toBeVisible({ timeout: 120000 });
		await website.waitForNestedIframes();
		await expect(wordpress.locator('body')).toContainText(
			'Saved Blueprint test',
			{ timeout: 120000 }
		);
		const newSite = await getActivePlaygroundSite(website.page);
		expect(newSite).toMatchObject({ persistence: 'autosave' });
		expect(newSite.slug).not.toBe(savedSite.slug);
		await expect
			.poll(() =>
				website.page.evaluate(
					(slug) =>
						(window as any).playgroundSites
							.list()
							.some((site: any) => site.slug === slug),
					savedSite.slug
				)
			)
			.toBe(true);

		await website.page.evaluate((slug) => {
			return (window as any).playgroundSites.setActiveSite(slug);
		}, savedSite.slug);
		await website.waitForNestedIframes();
		await website.openDockPane('Current Blueprint', 'Blueprint pane');
		await expect(
			website.page.locator('[class*="blueprint-editor"] .cm-content')
		).not.toContainText('Saved Blueprint test');
	});

	test('should offer full settings for an autosaved Playground', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.page.goto('./');
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({
			timeout: 120000,
		});
		const autosavedSite = await getActivePlaygroundSite(website.page);

		await website.openDockPane('Site Settings');

		await expect(
			website.page.getByText(
				'Stored Playgrounds have limited configuration options.'
			)
		).toHaveCount(0);
		await expect(
			website.page.getByLabel('WordPress version')
		).toBeEnabled();
		await expect(website.page.getByLabel('Language')).toBeEnabled();
		await expect(
			website.page.getByLabel('Create a multisite network')
		).toBeEnabled();
		await expect(
			website.page.getByRole('button', {
				name: 'Apply to this Playground',
				exact: true,
			})
		).toBeEnabled();

		await website.page
			.getByRole('button', { name: 'More settings actions' })
			.click();
		const applyMenuItem = website.page.getByRole('menuitem', {
			name: /Apply to this Playground/,
		});
		const freshMenuItem = website.page.getByRole('menuitem', {
			name: /Create a fresh Playground/,
		});
		await expect(freshMenuItem).toContainText(
			`“${autosavedSite.name}” stays in Recent autosaves until 5 newer autosaves replace it.`
		);
		await expect(applyMenuItem).toBeFocused();
		await expect(applyMenuItem).toHaveAttribute('aria-disabled', 'false');
		await website.page.keyboard.press('ArrowDown');
		await expect(freshMenuItem).toBeFocused();
		await website.page.keyboard.press('Home');
		await expect(applyMenuItem).toBeFocused();
		await website.page.keyboard.press('End');
		await expect(freshMenuItem).toBeFocused();

		const body = wordpress.locator('body');
		await body.evaluate((element) =>
			element.setAttribute('data-settings-no-op-marker', 'present')
		);
		await freshMenuItem.click();
		await expect(
			website.page.getByRole('button', {
				name: 'Create a fresh Playground',
				exact: true,
			})
		).toBeEnabled();
		await expect(body).toHaveAttribute(
			'data-settings-no-op-marker',
			'present'
		);
		await website.page
			.getByRole('button', { name: 'More settings actions' })
			.click();
		await website.page
			.getByRole('menuitem', { name: /Apply to this Playground/ })
			.click();
		await expect(
			website.page.getByRole('button', {
				name: 'Apply to this Playground',
				exact: true,
			})
		).toBeEnabled();
		await expect(body).toHaveAttribute(
			'data-settings-no-op-marker',
			'present'
		);
		await website.page
			.getByRole('button', {
				name: 'Apply to this Playground',
				exact: true,
			})
			.click();
		await expect(body).not.toHaveAttribute(
			'data-settings-no-op-marker',
			'present'
		);
	});

	test('should atomically apply PHP and network settings to the current autosave', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(
			getUniqueSavedPlaygroundSetupUrl('settings-recreate')
		);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const originalSite = await getActivePlaygroundSite(website.page);

		await website.openDockPane('Site Settings');
		const phpSelect = website.page.getByLabel('PHP version');
		const currentPhpVersion = await phpSelect.inputValue();
		const nextPhpVersion = currentPhpVersion === '8.4' ? '8.3' : '8.4';
		await phpSelect.selectOption(nextPhpVersion);
		await website.page.getByLabel('Allow network access').uncheck();
		const applySettingsButton = website.page.getByRole('button', {
			name: 'Apply to this Playground',
		});
		await expect(applySettingsButton).toBeEnabled();
		await applySettingsButton.click();
		await website.waitForNestedIframes();
		await expect
			.poll(() => getRunningPhpVersion(website.page), { timeout: 120000 })
			.toBe(nextPhpVersion);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page), {
				timeout: 120000,
			})
			.toMatchObject({
				slug: originalSite.slug,
				name: originalSite.name,
				persistence: 'autosave',
			});
		await expect
			.poll(() =>
				website.page.evaluate(
					(slug) =>
						(window as any).playgroundSites
							.list()
							.filter((site: any) => site.slug === slug).length,
					originalSite.slug
				)
			)
			.toBe(1);

		await website.openDockPane('Site Settings');
		await expect(website.page.getByLabel('PHP version')).toHaveValue(
			nextPhpVersion
		);
		await expect(
			website.page.getByLabel('Allow network access')
		).not.toBeChecked();
	});

	test('should create exactly one fresh Playground for structural settings', async ({
		website,
		browserName,
	}) => {
		test.skip(browserName !== 'chromium', 'This test requires OPFS.');

		await website.goto(getUniqueSavedPlaygroundSetupUrl('settings-fresh'));
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const originalSite = await getActivePlaygroundSite(website.page);
		const sitesBefore = await website.page.evaluate(
			() => (window as any).playgroundSites.list().length
		);

		await website.openDockPane('Site Settings');
		const wpSelect = website.page.getByLabel('WordPress version');
		const currentWpVersion = await wpSelect.inputValue();
		const nextWpVersion = Object.keys(MinifiedWordPressVersions).find(
			(version) =>
				!['beta', 'default', currentWpVersion].includes(version)
		)!;
		await wpSelect.selectOption(nextWpVersion);

		const mainAction = website.page.getByRole('button', {
			name: 'Create a fresh Playground',
			exact: true,
		});
		await expect(mainAction).toBeEnabled();
		await website.page
			.getByRole('button', { name: 'More settings actions' })
			.click();
		const applyMenuItem = website.page.getByRole('menuitem', {
			name: /Apply to this Playground/,
		});
		await expect(applyMenuItem).toHaveAttribute('aria-disabled', 'true');
		await expect(applyMenuItem).toContainText(
			'Changing WordPress version requires a fresh Playground.'
		);
		for (const menuItem of await website.page.getByRole('menuitem').all()) {
			expect(
				await menuItem.evaluate(
					(element) => element.scrollWidth <= element.clientWidth
				)
			).toBe(true);
		}
		await website.page.keyboard.press('Escape');

		// Two same-task clicks exercise the gap before React can paint disabled.
		await mainAction.evaluate((button: HTMLButtonElement) => {
			button.click();
			button.click();
		});
		await expect(
			website.page.getByRole('dialog', { name: 'Site Settings pane' })
		).not.toBeVisible({ timeout: 120000 });

		await expect
			.poll(
				() =>
					website.page.evaluate(
						() => (window as any).playgroundSites.list().length
					),
				{ timeout: 120000 }
			)
			.toBe(sitesBefore + 1);
		const freshSite = await getActivePlaygroundSite(website.page);
		expect(freshSite.slug).not.toBe(originalSite.slug);
		await expect
			.poll(() =>
				website.page.evaluate(
					(slug) =>
						(window as any).playgroundSites
							.list()
							.some((site: any) => site.slug === slug),
					originalSite.slug
				)
			)
			.toBe(true);
	});

	test('should offer the same full fresh-site form for an explicitly saved Playground', async ({
		website,
		browserName,
	}) => {
		test.skip(browserName !== 'chromium', 'This test requires OPFS.');

		await website.goto(getUniqueSavedPlaygroundSetupUrl('stored-settings'));
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		await website.page.getByRole('button', { name: 'Autosaved' }).click();
		const savePane = website.page.locator(
			'section[aria-label="Store permanently pane"]'
		);
		await savePane.getByRole('button', { name: 'Save' }).click();
		await expect(savePane).not.toBeVisible({ timeout: 120000 });
		await expect(
			website.page.getByText('Saved', { exact: true })
		).toBeVisible();
		const storedSite = await getActivePlaygroundSite(website.page);

		await website.openDockPane('Site Settings');
		await expect(
			website.page.getByLabel('WordPress version')
		).toBeEnabled();
		await expect(website.page.getByLabel('Language')).toBeEnabled();
		await expect(
			website.page.getByLabel('Create a multisite network')
		).toBeEnabled();
		await website.page
			.getByRole('button', { name: 'More settings actions' })
			.click();
		await expect(
			website.page.getByRole('menuitem', {
				name: /Create a fresh Playground/,
			})
		).toContainText(`“${storedSite.name}” stays in Saved Playgrounds.`);
		await website.page.keyboard.press('Escape');
		await website.page.getByLabel('Language').selectOption('pl_PL');
		await website.page
			.getByRole('button', {
				name: 'Create a fresh Playground',
				exact: true,
			})
			.click();
		await expect(
			website.page.getByRole('dialog', { name: 'Site Settings pane' })
		).not.toBeVisible({ timeout: 120000 });
		const freshSite = await getActivePlaygroundSite(website.page);
		expect(freshSite.slug).not.toBe(storedSite.slug);
		await expect
			.poll(() =>
				website.page.evaluate(
					(slug) =>
						(window as any).playgroundSites
							.list()
							.some(
								(site: any) =>
									site.slug === slug &&
									site.persistence === 'explicit'
							),
					storedSite.slug
				)
			)
			.toBe(true);
	});

	test('should keep Playground management failures visible across Dock surfaces', async ({
		website,
		browserName,
	}) => {
		test.skip(browserName !== 'chromium', 'This test requires OPFS.');

		await website.goto(getUniqueSavedPlaygroundSetupUrl('operation-error'));
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const originalSite = await getActivePlaygroundSite(website.page);
		const activeSite = await website.page.evaluate(async (originalSlug) => {
			const api = (window as any).playgroundSites;
			const slug = `operation-error-active-${Date.now().toString(36)}`;
			await api.createNewSavedSite(slug, undefined, {
				persistence: 'autosave',
				updateUrl: false,
				excludeFromPruning: [originalSlug],
			});
			return api.list().find((site: any) => site.slug === slug);
		}, originalSite.slug);
		await website.page.evaluate(() => {
			Object.defineProperty(window, 'showDirectoryPicker', {
				configurable: true,
				value: async () => {
					throw new Error('Simulated directory failure');
				},
			});
		});

		await website.openDockPane('Playgrounds');
		const pane = website.page.getByRole('dialog', {
			name: 'Playgrounds pane',
		});
		await pane.evaluate(async (element) => {
			await Promise.all(
				element.getAnimations().map((animation) => animation.finished)
			);
		});
		const paneBeforeFailure = await pane.boundingBox();
		await pane
			.getByRole('button', { name: `Actions for ${activeSite.name}` })
			.click();
		await website.page
			.getByRole('menuitem', { name: 'Save in a local directory…' })
			.click();
		const notice = website.page
			.getByRole('group', {
				name: 'Operation failed',
			})
			.filter({
				hasText: `Couldn’t save ${activeSite.name} locally`,
			});
		await expect(notice).toBeVisible();
		await expect(notice).toContainText(
			'The Playground in your browser is unchanged.'
		);
		await expect(
			notice.getByRole('button', { name: 'Try again' })
		).toHaveCount(0);
		await expect(
			website.page.locator('[role="alert"]').filter({
				hasText: `Couldn’t save ${activeSite.name} locally`,
			})
		).toHaveCount(1);
		await notice.evaluate(async (element) => {
			await Promise.all(
				element.getAnimations().map((animation) => animation.finished)
			);
		});
		const paneAfterFailure = await pane.boundingBox();
		const noticeBox = await notice.boundingBox();
		expect(paneAfterFailure).not.toBeNull();
		expect(paneBeforeFailure).not.toBeNull();
		expect(noticeBox).not.toBeNull();
		expect(paneAfterFailure!.x).toBeCloseTo(paneBeforeFailure!.x, 0);
		expect(paneAfterFailure!.y).toBeCloseTo(paneBeforeFailure!.y, 0);
		expect(paneAfterFailure!.width).toBeCloseTo(
			paneBeforeFailure!.width,
			0
		);
		expect(paneAfterFailure!.height).toBeCloseTo(
			paneBeforeFailure!.height,
			0
		);
		expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(
			paneAfterFailure!.y
		);

		await website.page.keyboard.press('Escape');
		await expect(pane).not.toBeVisible();
		await expect(notice).toBeVisible();
		await notice.evaluate(async (element) => {
			await Promise.all(
				element.getAnimations().map((animation) => animation.finished)
			);
		});
		const dock = website.page.getByRole('navigation', {
			name: 'Playground tools',
		});
		const closedNoticeBox = await notice.boundingBox();
		const dockBox = await dock.boundingBox();
		expect(closedNoticeBox).not.toBeNull();
		expect(dockBox).not.toBeNull();
		expect(
			closedNoticeBox!.y + closedNoticeBox!.height
		).toBeLessThanOrEqual(dockBox!.y);
		expect(closedNoticeBox!.x + closedNoticeBox!.width / 2).toBeCloseTo(
			dockBox!.x + dockBox!.width / 2,
			0
		);

		await website.openDockPane('Site Settings');
		const settingsPane = website.page.getByRole('dialog', {
			name: 'Site Settings pane',
		});
		await expect(notice).toBeVisible();
		await notice.evaluate(async (element) => {
			await Promise.all(
				element.getAnimations().map((animation) => animation.finished)
			);
		});
		const settingsPaneBox = await settingsPane.boundingBox();
		const settingsNoticeBox = await notice.boundingBox();
		expect(settingsPaneBox).not.toBeNull();
		expect(settingsNoticeBox).not.toBeNull();
		expect(
			settingsNoticeBox!.y + settingsNoticeBox!.height
		).toBeLessThanOrEqual(settingsPaneBox!.y);

		await website.openDockPane('Playgrounds');
		await pane
			.getByRole('button', { name: `Open ${originalSite.name}` })
			.click();
		await expect(pane).not.toBeVisible();
		await expect
			.poll(() => getActivePlaygroundSite(website.page), {
				timeout: 120000,
			})
			.toMatchObject({ slug: originalSite.slug });
		await expect(notice).toBeVisible();

		await website.page.setViewportSize({ width: 390, height: 844 });
		await expect
			.poll(() =>
				website.page.evaluate(
					() => window.matchMedia('(max-width: 1024px)').matches
				)
			)
			.toBe(true);
		await website.openDockPane('Playgrounds');
		await expect
			.poll(() => pane.boundingBox())
			.toMatchObject({
				x: 0,
				width: 390,
			});
		await expect(notice).toBeVisible();
		await notice.evaluate(async (element) => {
			await Promise.all(
				element.getAnimations().map((animation) => animation.finished)
			);
		});
		const mobileNoticeBox = await notice.boundingBox();
		const mobileDockBox = await dock.boundingBox();
		expect(mobileNoticeBox).not.toBeNull();
		expect(mobileDockBox).not.toBeNull();
		expect(mobileNoticeBox!.x).toBeGreaterThanOrEqual(12);
		expect(mobileNoticeBox!.x + mobileNoticeBox!.width).toBeLessThanOrEqual(
			378
		);
		expect(
			mobileNoticeBox!.y + mobileNoticeBox!.height
		).toBeLessThanOrEqual(mobileDockBox!.y);
		await notice
			.getByRole('button', { name: 'Dismiss operation error' })
			.click();
		await expect(notice).toHaveCount(0);
	});

	test('should reveal a full Playground title only when it is truncated', async ({
		website,
		browserName,
	}) => {
		test.skip(browserName !== 'chromium', 'This test requires OPFS.');

		const longName = `A Playground title long enough to be clipped ${'x'.repeat(28)}`;
		await website.goto(getUniqueSavedPlaygroundSetupUrl('long-title'));
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const activeSite = await getActivePlaygroundSite(website.page);
		await website.openDockPane('Playgrounds');
		const pane = website.page.getByRole('dialog', {
			name: 'Playgrounds pane',
		});
		const shortTitle = pane
			.locator('span[class*="siteRowName"]')
			.filter({ hasText: activeSite.name });
		await expect(shortTitle).toHaveAttribute('tabindex', '-1');
		await shortTitle.hover();
		await expect(
			website.page.getByRole('tooltip', {
				name: activeSite.name,
				exact: true,
			})
		).toHaveCount(0);
		await pane
			.getByRole('button', { name: `Actions for ${activeSite.name}` })
			.click();
		await website.page.getByRole('menuitem', { name: 'Rename' }).click();
		const renameInput = pane.getByRole('textbox', {
			name: 'Rename Playground',
		});
		await renameInput.fill(longName);
		await renameInput.press('Enter');
		const title = pane
			.locator('span[class*="siteRowName"]')
			.filter({ hasText: longName });
		await expect(title).toBeVisible();
		expect(
			await title.evaluate(
				(element) => element.scrollWidth > element.clientWidth
			)
		).toBe(true);
		await expect(title).toHaveAttribute('tabindex', '0');
		const tooltip = website.page.getByRole('tooltip', {
			name: longName,
			exact: true,
		});
		await title.focus();
		await expect(tooltip).toBeVisible({ timeout: 5000 });
		await website.page.keyboard.press('Tab');
		await expect(tooltip).not.toBeVisible({ timeout: 5000 });
		await title.hover();
		await expect(tooltip).toBeVisible({ timeout: 5000 });
	});

	test('should show inline creation tabs in the New pane', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);
		await mockGitHubOAuth(website.page, browserName);
		await mockGitHubRepositoryAnalysis(website.page);

		await website.goto(
			getUniqueSavedPlaygroundSetupUrl('creation-actions')
		);
		const siteSlugBeforeGitHubTab = new URL(
			website.page.url()
		).searchParams.get('site-slug');
		await website.openDockPane('New Playground');
		const newPane = website.page.getByRole('dialog', {
			name: 'New Playground pane',
		});
		await expect(
			newPane.getByRole('button', {
				name: 'Vanilla WordPress - New Playground',
				exact: true,
			})
		).toBeVisible();

		await newPane.locator('#creation-tab-write-own').click();
		expect(
			await newPane
				.getByRole('tablist', {
					name: 'Ways to start a new Playground',
				})
				.evaluate((tablist) => {
					const pane = tablist.closest('[role="dialog"]')!;
					const tablistRect = tablist.getBoundingClientRect();
					const paneRect = pane.getBoundingClientRect();
					return {
						leftInset: Math.round(tablistRect.left - paneRect.left),
						rightInset: Math.round(
							paneRect.right - tablistRect.right
						),
						overflows: tablist.scrollWidth > tablist.clientWidth,
					};
				})
		).toEqual({ leftInset: 24, rightInset: 24, overflows: false });
		const draft = newPane.locator('.cm-content');
		await expect(draft).toBeFocused({ timeout: 5000 });
		await draft.fill(
			JSON.stringify({ landingPage: '/draft-kept/', steps: [] }, null, 2)
		);
		await expect(draft).toContainText('draft-kept');

		await website.openDockPane('Database');
		await website.openDockPane('New Playground');
		await newPane.locator('#creation-tab-write-own').click();
		await expect(newPane.locator('.cm-content')).toContainText(
			'draft-kept'
		);

		await website.page.keyboard.press('Escape');
		await website.openDockPane('New Playground');
		const galleryTab = newPane.locator('#creation-tab-gallery');
		const blueprintUrlTab = newPane.locator('#creation-tab-blueprint-url');
		const writeTab = newPane.locator('#creation-tab-write-own');
		const pullRequestTab = newPane.locator('#creation-tab-pull-request');
		const githubTab = newPane.locator('#creation-tab-github');
		await galleryTab.click();
		await galleryTab.focus();
		await galleryTab.press('ArrowRight');
		await expect(blueprintUrlTab).toBeFocused();
		await blueprintUrlTab.press('ArrowRight');
		await expect(writeTab).toBeFocused({ timeout: 5000 });
		await expect(newPane.locator('.cm-content')).not.toBeFocused({
			timeout: 5000,
		});
		await expect(newPane.locator('.cm-content')).toContainText(
			'draft-kept'
		);
		await writeTab.press('ArrowRight');
		await expect(pullRequestTab).toBeFocused();
		await pullRequestTab.press('ArrowRight');
		await expect(githubTab).toBeFocused();
		await expect(
			newPane.getByRole('tablist', {
				name: 'Ways to start a new Playground',
			})
		).toBeVisible();
		await newPane
			.getByRole('link', { name: 'Connect your GitHub account' })
			.click();
		const githubUrlInput = newPane.getByRole('textbox', {
			name: /I want to import from this GitHub URL/,
		});
		await expect(githubUrlInput).toBeVisible();

		await pullRequestTab.click();
		await expect(
			newPane.getByRole('heading', { name: 'Preview a pull request' })
		).toBeVisible();
		await expect(
			newPane.getByRole('textbox', {
				name: 'Pull request URL or number',
			})
		).toBeVisible();
		await expect(
			newPane.getByRole('button', { name: 'Preview', exact: true })
		).toBeVisible();

		await githubTab.click();
		await expect(
			newPane.getByRole('heading', {
				name: 'Import from GitHub',
				level: 3,
			})
		).toBeVisible();
		await expect(
			newPane.getByRole('tablist', {
				name: 'Ways to start a new Playground',
			})
		).toBeVisible();
		await expect(githubUrlInput).toBeVisible();
		await expect(
			newPane.getByRole('button', { name: 'Continue', exact: true })
		).toBeVisible();
		await expect(
			website.page.getByRole('dialog', {
				name: 'Import from GitHub pane',
			})
		).toHaveCount(0);
		expect(new URL(website.page.url()).searchParams.get('site-slug')).toBe(
			siteSlugBeforeGitHubTab
		);

		await githubUrlInput.fill(
			'https://github.com/playground-test/import-source'
		);
		await newPane
			.getByRole('button', { name: 'Continue', exact: true })
			.click();
		const githubImportPane = website.page.getByRole('dialog', {
			name: 'Import from GitHub pane',
		});
		await expect(
			githubImportPane.getByRole('heading', {
				name: 'Import from GitHub',
				level: 2,
			})
		).toBeVisible();
		await expect(
			githubImportPane.getByRole('combobox', {
				name: 'I am importing a:',
			})
		).toBeVisible();
		const creationBackButton = githubImportPane.getByRole('button', {
			name: 'Back to the GitHub repository URL',
		});
		await expect(creationBackButton).toBeFocused();
		await creationBackButton.click();
		await expect(githubUrlInput).toHaveValue(
			'https://github.com/playground-test/import-source'
		);
		await expect(
			newPane.getByRole('combobox', {
				name: 'I am importing a:',
			})
		).toHaveCount(0);
		await expect(
			newPane.getByRole('button', { name: 'Continue', exact: true })
		).toBeVisible();
		await expect(githubTab).toBeFocused();
	});

	test('should open GitHub export as a styled subpanel', async ({
		website,
		browserName,
	}) => {
		await mockGitHubOAuth(website.page, browserName);
		await website.goto(
			'./?storage=temp' +
				'&ghexport-repo-url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo' +
				'&ghexport-content-type=wp-content' +
				'&ghexport-pr-action=create' +
				'&ghexport-repo-root=%2Fwp-content' +
				'&ghexport-commit-message=Changes%20from%20Playground'
		);

		// Open a retained New subpanel first. Switching to Export must hide it,
		// not stack the two retained panels in one scroll container.
		await website.openDockPane('New Playground');
		const newPane = website.page.getByRole('dialog', {
			name: 'New Playground pane',
		});
		await newPane.locator('#creation-tab-github').click();
		await website.page
			.getByRole('link', { name: 'Connect your GitHub account' })
			.click();
		const importIntro = website.page.getByText(
			/You may import WordPress plugins/
		);
		await expect(importIntro).toBeVisible();

		await website.openDockPane('Export');
		const exportOptionsPane = website.page.getByRole('dialog', {
			name: 'Export pane',
		});
		const openGitHubExport = exportOptionsPane.getByRole('button', {
			name: 'Export to GitHub',
			exact: true,
		});
		await expect(openGitHubExport).toBeEnabled({ timeout: 120000 });
		await openGitHubExport.click();

		const githubExportPane = website.page.getByRole('dialog', {
			name: 'Export to GitHub pane',
		});
		const heading = githubExportPane.getByRole('heading', {
			name: 'Export to GitHub',
			level: 2,
		});
		await expect(heading).toBeVisible();
		await expect(importIntro).not.toBeVisible();
		const backButton = githubExportPane.getByRole('button', {
			name: 'Back to export options',
		});
		await expect(backButton).toBeVisible();

		const contentType = githubExportPane.getByRole('combobox', {
			name: 'I am exporting:',
		});
		const repoUrl = githubExportPane.getByRole('textbox', {
			name: /Pull Request to target this GitHub repo/,
		});
		const commitMessage = githubExportPane.getByRole('textbox', {
			name: 'Commit message:',
		});
		await expect(contentType).toBeVisible();
		await expect(repoUrl).toBeVisible();
		await expect(commitMessage).toBeVisible();
		await expect(repoUrl).toBeFocused();
		expect(
			await contentType.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					borderRadius: style.borderRadius,
					fontSize: style.fontSize,
					minHeight: style.minHeight,
					paddingTop: style.paddingTop,
				};
			})
		).toEqual({
			borderRadius: '8px',
			fontSize: '15px',
			minHeight: '42px',
			paddingTop: '10px',
		});
		const [commitMessageFont, repoUrlFont] = await Promise.all([
			commitMessage.evaluate(
				(element) => getComputedStyle(element).fontFamily
			),
			repoUrl.evaluate((element) => getComputedStyle(element).fontFamily),
		]);
		expect(commitMessageFont).toBe(repoUrlFont);

		const formPanel = githubExportPane.getByRole('region', {
			name: 'Export to GitHub form',
		});
		await expect
			.poll(() =>
				formPanel.evaluate(
					(element) => element.scrollHeight > element.clientHeight
				)
			)
			.toBe(true);
		const headingTop = await heading.evaluate(
			(element) => element.getBoundingClientRect().top
		);
		await formPanel.hover();
		await website.page.mouse.wheel(0, 1000);
		await expect
			.poll(() => formPanel.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
		expect(
			await heading.evaluate(
				(element) => element.getBoundingClientRect().top
			)
		).toBe(headingTop);

		await backButton.click();
		await expect(openGitHubExport).toBeFocused();
		await expect(
			exportOptionsPane.getByRole('heading', {
				name: 'Export',
				level: 2,
			})
		).toBeVisible();
	});

	for (const { name, viewport } of [
		{ name: 'desktop', viewport: { width: 1280, height: 600 } },
		{ name: 'mobile', viewport: { width: 320, height: 600 } },
	]) {
		test(`should scroll the dedicated GitHub import form on ${name}`, async ({
			website,
			browserName,
		}) => {
			await website.page.setViewportSize(viewport);
			await mockGitHubOAuth(website.page, browserName);
			await mockGitHubRepositoryAnalysis(website.page);
			await website.goto('./?storage=temp');
			await website.openDockPane('New Playground');
			const newPane = website.page.getByRole('dialog', {
				name: 'New Playground pane',
			});
			const githubTab = newPane.locator('#creation-tab-github');
			await githubTab.click();
			await newPane
				.getByRole('link', { name: 'Connect your GitHub account' })
				.click();
			await newPane
				.getByRole('textbox', {
					name: /I want to import from this GitHub URL/,
				})
				.fill('https://github.com/playground-test/import-source');
			await newPane
				.getByRole('button', { name: 'Continue', exact: true })
				.click();
			const githubImportPane = website.page.getByRole('dialog', {
				name: 'Import from GitHub pane',
			});
			const formPanel = githubImportPane.getByRole('region', {
				name: 'Import from GitHub',
			});
			await formPanel
				.getByRole('button', { name: 'Need an example?' })
				.click();
			await expect
				.poll(() =>
					formPanel.evaluate(
						(element) => element.scrollHeight > element.clientHeight
					)
				)
				.toBe(true);
			await formPanel.hover();
			await website.page.mouse.wheel(0, 1000);
			await expect
				.poll(() => formPanel.evaluate((element) => element.scrollTop))
				.toBeGreaterThan(0);

			await githubImportPane
				.getByRole('button', {
					name: 'Back to the GitHub repository URL',
				})
				.click();
			await expect(
				newPane.getByRole('tablist', {
					name: 'Ways to start a new Playground',
				})
			).toBeVisible();
			await expect(newPane.locator('#creation-tab-github')).toBeFocused();
		});
	}

	test('should rename an inactive autosaved Playground without keeping it', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(getUniqueSavedPlaygroundSetupUrl('rename-autosave'));
		const setup = await website.page.evaluate(async () => {
			const api = (window as any).playgroundSites;
			await api.isReady();
			const suffix = Date.now().toString(36);
			const targetSlug = `rename-target-${suffix}`;
			const activeSlug = `rename-active-${suffix}`;
			await api.createNewSavedSite(targetSlug, undefined, {
				persistence: 'autosave',
				updateUrl: false,
			});
			await api.createNewSavedSite(activeSlug, undefined, {
				persistence: 'autosave',
				updateUrl: false,
				excludeFromPruning: [targetSlug],
			});
			const sites = api.list();
			const target = sites.find((site: any) => site.slug === targetSlug);
			const active = sites.find((site: any) => site.slug === activeSlug);
			return {
				targetSlug,
				targetName: target.name,
				activeSlug,
				activeName: active.name,
			};
		});

		await website.openPlaygroundsPane();
		const targetRow = website.page.locator(
			`[data-playground-row="${setup.targetSlug}"]`
		);
		await targetRow
			.getByRole('button', { name: `Actions for ${setup.targetName}` })
			.click();
		await website.page.getByRole('menuitem', { name: 'Rename' }).click();

		const nameInput = targetRow.getByRole('textbox', {
			name: 'Rename Playground',
		});
		const newName = `Renamed Recovery ${Date.now()}`;
		await expect(nameInput).toHaveValue(setup.targetName);
		await nameInput.fill(newName);
		await nameInput.press('Enter');
		await expect(nameInput).not.toBeVisible();
		await expect
			.poll(() =>
				website.page.evaluate(
					(targetSlug) =>
						(window as any).playgroundSites
							.list()
							.find((site: any) => site.slug === targetSlug)
							?.name,
					setup.targetSlug
				)
			)
			.toBe(newName);

		const sitesAfterRename = await website.page.evaluate(
			({ targetSlug, activeSlug }) => {
				const sites = (window as any).playgroundSites.list();
				return {
					target: sites.find((site: any) => site.slug === targetSlug),
					active: sites.find((site: any) => site.slug === activeSlug),
				};
			},
			{
				targetSlug: setup.targetSlug,
				activeSlug: setup.activeSlug,
			}
		);
		expect(sitesAfterRename.target).toMatchObject({
			name: newName,
			persistence: 'autosave',
			isActive: false,
		});
		expect(sitesAfterRename.active).toMatchObject({
			name: setup.activeName,
			persistence: 'autosave',
			isActive: true,
		});
	});

	test('should treat New Playground as an explicit fresh start', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(getUniqueSavedPlaygroundSetupUrl('explicit-new'));
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const firstSite = await getActivePlaygroundSite(website.page);

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('button', {
				name: 'Vanilla WordPress - New Playground',
				exact: true,
			})
			.click();
		const newPane = website.page.getByRole('dialog', {
			name: 'New Playground pane',
		});
		await expect(newPane).not.toBeVisible({ timeout: 1000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page), {
				timeout: 120000,
			})
			.not.toMatchObject({ slug: firstSite.slug });
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const firstBlankSite = await getActivePlaygroundSite(website.page);

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('button', {
				name: 'Vanilla WordPress - New Playground',
				exact: true,
			})
			.click();
		await expect(newPane).not.toBeVisible({ timeout: 1000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page), {
				timeout: 120000,
			})
			.not.toMatchObject({ slug: firstBlankSite.slug });
		await expect(
			website.page.getByLabel('Recent autosaved Playground')
		).toHaveCount(0);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });

		await website.openPlaygroundsPane();
		await website.page.evaluate(() => {
			(window as any).__siteSwitchStatusSamples = [];
			const sampleStatus = () => {
				const status = [
					...document.querySelectorAll(
						'[role="status"], [role="progressbar"], button'
					),
				]
					.map((node) => (node.textContent || '').trim())
					.find((text) =>
						[
							'Autosaving',
							'Saving',
							'Autosaved',
							'Saved',
							'Unsaved',
						].includes(text)
					);
				if (status) {
					(window as any).__siteSwitchStatusSamples.push(status);
				}
			};
			const observer = new MutationObserver(sampleStatus);
			observer.observe(document.documentElement, {
				attributes: true,
				characterData: true,
				childList: true,
				subtree: true,
			});
			(window as any).__siteSwitchStatusObserver = observer;
			(window as any).__siteSwitchStatusInterval = window.setInterval(
				sampleStatus,
				25
			);
			sampleStatus();
		});
		await website.page
			.getByRole('button', {
				name: `Open ${firstSite.name}`,
				exact: true,
			})
			.click();
		await expect(
			website.page.getByRole('dialog', {
				name: 'Your Playgrounds pane',
			})
		).not.toBeVisible({ timeout: 1000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page), {
				timeout: 120000,
			})
			.toMatchObject({ slug: firstSite.slug });
		const switchStatusSamples = await website.page.evaluate(() => {
			window.clearInterval((window as any).__siteSwitchStatusInterval);
			(window as any).__siteSwitchStatusObserver?.disconnect();
			return (window as any).__siteSwitchStatusSamples;
		});
		expect(switchStatusSamples).not.toContain('Autosaving');
		await expect(
			website.page
				.getByRole('status')
				.filter({ hasText: /Save complete|Autosave complete/ })
		).toHaveCount(0);
	});

	test('should show autosaved status without an unsaved Site Settings warning', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(getUniqueSavedPlaygroundSetupUrl('storage-details'));
		await website.ensureSiteManagerIsOpen();

		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible();
		await expect(
			website.page.getByText(
				'This is an Unsaved Playground. Your changes will be lost on page refresh.'
			)
		).toHaveCount(0);
	});

	test('should promote a default autosaved Playground when kept', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(getUniqueSavedPlaygroundSetupUrl('promote'));
		await website.ensureSiteManagerIsClosed();
		const statusButton = website.page.getByRole('button', {
			name: 'Autosaved',
		});
		await expect(statusButton).toBeVisible({ timeout: 120000 });
		await statusButton.click();
		const savePane = website.page.locator(
			'section[aria-label="Store permanently pane"]'
		);
		await expect(savePane).toBeVisible();
		await expect(
			savePane.getByText('Save in browser storage')
		).toBeVisible();
		await expect(
			savePane.getByText('Save in a local directory')
		).toBeVisible();
		await savePane.getByRole('button', { name: 'Save' }).click();
		await expect(savePane).not.toBeVisible({ timeout: 120000 });

		await expect
			.poll(() =>
				website.page.evaluate(() => {
					const sites = (window as any).playgroundSites.list();
					return sites.find((site: any) => site.isActive)
						?.persistence;
				})
			)
			.toBe('explicit');
		await expect(
			website.page.getByText(/Autosaved|Finalizing autosave/)
		).toHaveCount(0);
		await expect(
			website.page
				.getByRole('navigation', { name: 'Playground tools' })
				.getByText('Saved', { exact: true })
		).toBeVisible();
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toHaveCount(0);
	});

	test('should save a default autosaved Playground to a local directory', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.page.addInitScript(() => {
			Object.defineProperty(window, 'showDirectoryPicker', {
				value: async () => {
					const root = await navigator.storage.getDirectory();
					const directory = await root.getDirectoryHandle(
						`e2e-local-save-${Date.now()}`,
						{ create: true }
					);
					(window as any).__e2eLocalDirectory = directory;
					return directory;
				},
				configurable: true,
			});
		});

		await website.goto(getUniqueSavedPlaygroundSetupUrl('local-dir'));
		await website.ensureSiteManagerIsClosed();
		const statusButton = website.page.getByRole('button', {
			name: 'Autosaved',
		});
		await expect(statusButton).toBeVisible({ timeout: 120000 });

		await statusButton.click();
		const savePane = website.page.locator(
			'section[aria-label="Store permanently pane"]'
		);
		await expect(savePane).toBeVisible();
		await expect(
			savePane.getByText('Save in a local directory (not available)')
		).toHaveCount(0, { timeout: 30000 });
		await savePane
			.getByRole('radio', { name: /Save in a local directory/ })
			.check();
		await savePane.getByRole('button', { name: 'Choose...' }).click();
		await savePane.getByRole('button', { name: 'Save' }).click();

		await expect(savePane).not.toBeVisible({ timeout: 90000 });
		await expect
			.poll(() =>
				website.page.evaluate(() => {
					const sites = (window as any).playgroundSites.list();
					const activeSite = sites.find((site: any) => site.isActive);
					return {
						storage: activeSite?.storage,
						persistence: activeSite?.persistence,
					};
				})
			)
			.toEqual({ storage: 'local-fs', persistence: 'explicit' });
		await expect(
			website.page
				.getByRole('navigation', { name: 'Playground tools' })
				.getByRole('button', { name: 'Saved', exact: true })
		).toBeVisible();
		expect(
			await website.page.evaluate(async () => {
				const directory = (window as any)
					.__e2eLocalDirectory as FileSystemDirectoryHandle;
				try {
					await directory.getFileHandle('wp-config.php');
					return true;
				} catch {
					return false;
				}
			})
		).toBe(true);
	});

	test('should persist WordPress changes after refreshing the default Playground', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(getUniqueSavedPlaygroundSetupUrl('restore'));
		expect(new URL(website.page.url()).searchParams.get('site-slug')).toBe(
			null
		);

		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });

		const expectedBlogName = `Saved Playground ${Date.now()}`;
		await runPHPAndFlushOpfs(
			website.page,
			updateBlogNameCode(expectedBlogName)
		);

		await website.page.reload();
		await expect(
			website.page.getByLabel('Recent autosaved Playground')
		).toBeVisible();
		await expect(
			website.page
				.getByLabel('Recent autosaved Playground')
				.getByText('Recent autosave', { exact: true })
		).toBeVisible();
		await website.waitForNestedIframes();
		await expect(
			website.page.getByRole('button', { name: 'Unsaved' })
		).toBeVisible();
		await website.page
			.getByRole('button', { name: 'Restore autosave' })
			.click();
		await website.waitForNestedIframes();
		await expect
			.poll(() =>
				new URL(website.page.url()).searchParams.get('site-slug')
			)
			.toBeTruthy();

		const blogName = await website.page.evaluate(async () => {
			const playground = (window as any).playground;
			const result = await playground.run({
				code: `<?php
require_once '/wordpress/wp-load.php';
echo get_option('blogname');
`,
			});
			return result.text;
		});
		expect(blogName).toBe(expectedBlogName);
	});

	test('should persist disabling the You Have Autosave nudge', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		const setupUrl = getUniqueSavedPlaygroundSetupUrl('restore-opt-out');
		await website.goto(setupUrl);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });

		await website.page.goto(setupUrl);
		const nudge = website.page.getByLabel('Recent autosaved Playground');
		await expect(nudge).toBeVisible();
		await nudge
			.getByRole('button', { name: 'Don’t notify me about autosaves' })
			.click();
		await expect(nudge).toHaveCount(0);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		expect(
			await website.page.evaluate(() =>
				localStorage.getItem(
					'playground-you-have-autosave-nudge-enabled'
				)
			)
		).toBe('false');

		await website.page.goto(setupUrl);
		await expect(nudge).toHaveCount(0);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page))
			.toMatchObject({ storage: 'opfs', persistence: 'autosave' });
	});

	test('should dismiss the restore card and autosave when WordPress is clicked', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		const setupUrl = getUniqueSavedPlaygroundSetupUrl('restore-outside');
		await website.goto(setupUrl);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		await website.page.goto(setupUrl);
		const nudge = website.page.getByLabel('Recent autosaved Playground');
		await expect(nudge).toBeVisible();
		await website.waitForNestedIframes();

		await wordpress.locator('body').click({ position: { x: 20, y: 20 } });
		await expect(nudge).toHaveCount(0);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page))
			.toMatchObject({ storage: 'opfs', persistence: 'autosave' });
	});

	test('should keep the mobile restore card inside the viewport and mark Playgrounds', async ({
		website,
		browserName,
	}) => {
		test.skip(browserName !== 'chromium', 'This test requires OPFS.');
		await website.page.setViewportSize({ width: 390, height: 844 });
		const setupUrl = getUniqueSavedPlaygroundSetupUrl('mobile-restore');
		await website.goto(setupUrl);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });

		await website.page.goto(setupUrl);
		const nudge = website.page.getByLabel('Recent autosaved Playground');
		const dock = website.page.getByRole('navigation', {
			name: 'Playground tools',
		});
		const playgroundsButton = dock.getByRole('button', {
			name: /Playgrounds/,
		});
		await expect(nudge).toBeVisible();
		await expect(playgroundsButton).toHaveAccessibleName(
			'Your Playgrounds — recent autosave available'
		);
		await assertRestoreCardGeometry();

		await website.page.setViewportSize({ width: 320, height: 600 });
		await assertRestoreCardGeometry();

		async function assertRestoreCardGeometry() {
			const geometry = await website.page.evaluate(() => {
				const card = document.querySelector<HTMLElement>(
					'[aria-label="Recent autosaved Playground"]'
				)!;
				const cardRect = card.getBoundingClientRect();
				return {
					cardTop: cardRect.top,
					cardLeft: cardRect.left,
					cardRight: cardRect.right,
					cardBottom: cardRect.bottom,
					viewportWidth: window.innerWidth,
					viewportHeight: window.innerHeight,
				};
			});
			expect(geometry.cardTop).toBeGreaterThanOrEqual(0);
			expect(geometry.cardLeft).toBeGreaterThanOrEqual(0);
			expect(geometry.cardRight).toBeLessThanOrEqual(
				geometry.viewportWidth
			);
			expect(geometry.cardBottom).toBeLessThanOrEqual(
				geometry.viewportHeight
			);
		}
	});

	test('should start fresh from a setup URL when an autosave exists', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		const setupName = `fresh-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2)}`;
		await website.goto(`./?php=8.3&name=${setupName}&random=first`);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });

		const firstBlogName = `Restored Playground ${Date.now()}`;
		await runPHPAndFlushOpfs(
			website.page,
			updateBlogNameCode(firstBlogName)
		);

		await website.page.goto(`./?php=8.3&name=${setupName}&cb=cache-buster`);
		await expect(
			website.page.getByLabel('Recent autosaved Playground')
		).toBeVisible();
		await website.waitForNestedIframes();
		await expect(
			website.page.getByRole('button', { name: 'Unsaved' })
		).toBeVisible();
		expect(new URL(website.page.url()).searchParams.get('site-slug')).toBe(
			null
		);
		await expect
			.poll(() =>
				website.page.evaluate(() => {
					const activeSite = (window as any).playgroundSites
						.list()
						.find((site: any) => site.isActive);
					return {
						storage: activeSite?.storage,
						persistence: activeSite?.persistence,
					};
				})
			)
			.toEqual({ storage: 'temporary', persistence: undefined });

		const freshBlogName = await website.page.evaluate(async () => {
			const playground = (window as any).playground;
			const result = await playground.run({
				code: `<?php
require_once '/wordpress/wp-load.php';
echo get_option('blogname');
`,
			});
			return result.text;
		});
		expect(freshBlogName).not.toBe(firstBlogName);

		const iframeToken = `keep-running-${Date.now()}`;
		await website.page
			.locator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.evaluate((iframe: HTMLIFrameElement, token) => {
				(iframe.contentWindow as any).__playgroundIframeToken = token;
			}, iframeToken);

		await website.page.evaluate(() => {
			(window as any).__keepNewStatusSamples = [];
			const sampleStatus = () => {
				const status = [
					...document.querySelectorAll(
						'[role="status"], [role="progressbar"], button'
					),
				]
					.map((node) => (node.textContent || '').trim())
					.find((text) =>
						[
							'Autosaving',
							'Saving',
							'Autosaved',
							'Saved',
							'Unsaved',
						].includes(text)
					);
				if (status) {
					(window as any).__keepNewStatusSamples.push(status);
				}
			};
			const observer = new MutationObserver(sampleStatus);
			observer.observe(document.documentElement, {
				attributes: true,
				characterData: true,
				childList: true,
				subtree: true,
			});
			(window as any).__keepNewStatusObserver = observer;
			(window as any).__keepNewStatusInterval = window.setInterval(
				sampleStatus,
				25
			);
			sampleStatus();
		});
		await website.page
			.getByRole('button', { name: 'Keep this Playground' })
			.click();
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const keepNewStatusSamples = await website.page.evaluate(() => {
			window.clearInterval((window as any).__keepNewStatusInterval);
			(window as any).__keepNewStatusObserver?.disconnect();
			return (window as any).__keepNewStatusSamples;
		});
		expect(keepNewStatusSamples).toContain('Autosaving');
		expect(keepNewStatusSamples).not.toContain('Saving');
		await expect
			.poll(() =>
				website.page.evaluate(() => {
					const activeSite = (window as any).playgroundSites
						.list()
						.find((site: any) => site.isActive);
					return {
						storage: activeSite?.storage,
						persistence: activeSite?.persistence,
					};
				})
			)
			.toEqual({ storage: 'opfs', persistence: 'autosave' });
		await expect
			.poll(() =>
				website.page
					.locator(
						'#playground-viewport:visible,.playground-viewport:visible'
					)
					.evaluate(
						(iframe: HTMLIFrameElement) =>
							(iframe.contentWindow as any)
								.__playgroundIframeToken
					)
			)
			.toBe(iframeToken);
	});

	test('should fall back to an unsaved Playground when browser storage is unavailable', async ({
		website,
	}) => {
		await website.page.addInitScript(() => {
			Object.defineProperty(navigator.storage, 'getDirectory', {
				value: undefined,
				configurable: true,
			});
			Object.defineProperty(window, 'showDirectoryPicker', {
				value: undefined,
				configurable: true,
			});
		});

		await website.goto('./');
		await website.ensureSiteManagerIsClosed();

		expect(new URL(website.page.url()).searchParams.get('site-slug')).toBe(
			null
		);
		const dock = website.page.getByRole('navigation', {
			name: 'Playground tools',
		});
		await expect(dock.getByText('Unsaved', { exact: true })).toBeVisible();
		await expect(dock.getByRole('button', { name: 'Unsaved' })).toHaveCount(
			0
		);
		await expect(
			website.page.locator('section[aria-label="Store permanently pane"]')
		).toHaveCount(0);
	});

	test('should show "Unsaved" status for storage=temp Playgrounds', async ({
		website,
	}) => {
		await website.goto('./?storage=temp');
		await website.ensureSiteManagerIsClosed();

		const dock = website.page.getByRole('navigation', {
			name: 'Playground tools',
		});
		await expect(dock.getByText('Unsaved', { exact: true })).toBeVisible();
		const canStorePermanently = await website.page.evaluate(async () => {
			try {
				await navigator.storage.getDirectory();
				return true;
			} catch {
				return Boolean((window as any).showDirectoryPicker);
			}
		});
		const indicator = dock.getByRole('button', { name: 'Unsaved' });
		const savePane = website.page.locator(
			'section[aria-label="Store permanently pane"]'
		);
		if (canStorePermanently) {
			await expect(indicator).toBeVisible();
			await indicator.click();
			await expect(savePane).toBeVisible();
		} else {
			await expect(indicator).toHaveCount(0);
			await expect(savePane).toHaveCount(0);
		}
		expect(new URL(website.page.url()).searchParams.get('storage')).toBe(
			'temp'
		);
	});

	test('should not duplicate the unsaved warning in Site Settings', async ({
		website,
	}) => {
		await website.goto('./?storage=temp');
		await website.ensureSiteManagerIsOpen();

		await expect(website.page.getByLabel('PHP version')).toBeVisible();
		await expect(
			website.page.getByText(
				'This is an Unsaved Playground. Your changes will be lost on page refresh.'
			)
		).toHaveCount(0);
	});

	test('should not show "Unsaved" status when "can-save=no" is set', async ({
		website,
	}) => {
		await website.goto('./?can-save=no');
		await website.ensureSiteManagerIsClosed();

		const indicator = website.page.getByRole('button', {
			name: 'Unsaved',
		});
		await expect(indicator).toHaveCount(0);
		await expect(
			website.page
				.getByRole('navigation', { name: 'Playground tools' })
				.getByText('Unsaved', { exact: true })
		).toHaveCount(0);
	});

	test('should not see save playground message in the Site Manager when "can-save=no" is set', async ({
		website,
	}) => {
		await website.goto('./?can-save=no');
		await website.ensureSiteManagerIsOpen();

		const indicator = website.page.getByText(
			'This is an Unsaved Playground. Your changes will be lost on page refresh.'
		);
		await expect(indicator).toHaveCount(0);
	});

	test('should not show autosave status in seamless mode', async ({
		website,
	}) => {
		await website.page.goto('./?mode=seamless');
		await expect(
			website.page.locator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
		).toBeVisible();

		await expect(
			website.page.getByRole('button', { name: /Autosaved|Unsaved/ })
		).toHaveCount(0);
	});

	test('should not show autosave status when embedded in an iframe', async ({
		website,
	}, testInfo) => {
		const embeddedUrl = new URL(
			`./?name=embedded-${Date.now()}`,
			String(testInfo.project.use.baseURL)
		).href;
		await website.page.goto('./', { waitUntil: 'domcontentloaded' });
		await website.page.setContent(
			`<iframe title="Embedded Playground test" src="${embeddedUrl}"></iframe>`
		);

		const playgroundFrame = website.page.frameLocator(
			'iframe[title="Embedded Playground test"]'
		);
		await expect(
			playgroundFrame.getByRole('navigation', {
				name: 'Playground tools',
			})
		).toBeVisible();

		await expect(
			playgroundFrame.getByRole('button', { name: /Autosaved|Unsaved/ })
		).toHaveCount(0);
	});

	test('should keep a Playground saved after saving from the restore nudge state', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		// `random` is intentionally ignored by autosave fingerprints. `name`
		// is a setup param, so it isolates this test's autosave without
		// changing the default WordPress boot.
		const setupUrl = `./?name=restore-nudge-${Date.now()}`;
		await website.goto(setupUrl);
		await website.page.waitForFunction(() => {
			const api = (window as any).playgroundSites;
			const activeSite = api?.list().find((site: any) => site.isActive);
			return (
				activeSite?.storage === 'opfs' &&
				activeSite?.persistence === 'autosave'
			);
		});

		await website.goto(setupUrl);
		await expect(
			website.page.getByLabel('Recent autosaved Playground')
		).toBeVisible();

		// Regression: saving the temporary Playground before answering the
		// restore nudge must not be undone when the nudge is dismissed.
		await website.page.getByRole('button', { name: 'Unsaved' }).click();
		const savePane = website.page.locator(
			'section[aria-label="Store permanently pane"]'
		);
		await expect(savePane).toBeVisible();
		await savePane.getByRole('button', { name: 'Save' }).click();
		await expect(savePane).not.toBeVisible({ timeout: 120000 });
		await website.page.waitForFunction(() => {
			const api = (window as any).playgroundSites;
			const activeSite = api?.list().find((site: any) => site.isActive);
			return (
				activeSite?.storage === 'opfs' &&
				activeSite?.persistence === 'explicit'
			);
		});

		const keepNewButton = website.page.getByRole('button', {
			name: 'Keep this Playground',
		});
		// Saving may route directly to the saved Playground and clear the
		// nudge. If it stays visible, dismissing it must not undo the save.
		if (await keepNewButton.isVisible()) {
			await keepNewButton.click();
		}
		await expect(
			website.page.getByLabel('Recent autosaved Playground')
		).toHaveCount(0);
		await expect(
			website.page
				.getByRole('navigation', { name: 'Playground tools' })
				.getByText('Saved', { exact: true })
		).toBeVisible();
		await website.page.waitForFunction(() => {
			const api = (window as any).playgroundSites;
			const activeSite = api?.list().find((site: any) => site.isActive);
			return activeSite?.persistence === 'explicit';
		});
	});
});

test('should not include Google Analytics when VITE_GOOGLE_ANALYTICS_ID is not set', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	const gtmScripts = await website.page
		.locator('script[src*="googletagmanager.com"]')
		.count();
	expect(gtmScripts).toBe(0);
});
