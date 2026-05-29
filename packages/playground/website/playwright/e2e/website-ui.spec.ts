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

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

SupportedPHPVersions.forEach(async (version) => {
	test(`should switch PHP version to ${version}`, async ({ website }) => {
		await website.goto('./?storage=temp');
		await website.ensureSiteManagerIsOpen();
		await website.page.getByLabel('PHP version').selectOption(version);
		await website.page
			.getByText('Apply Settings & Reset Playground')
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
				.getByText('Apply Settings & Reset Playground')
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
	await website.page.getByText('Apply Settings & Reset Playground').click();
	await website.ensureSiteManagerIsClosed();
	await website.ensureSiteManagerIsOpen();

	await expect(website.page.getByLabel('Network access')).toBeChecked();
});

test('should disable networking when requested', async ({ website }) => {
	await website.goto('./?storage=temp&networking=yes');

	await website.ensureSiteManagerIsOpen();
	await website.page.getByLabel('Network access').uncheck();
	await website.page.getByText('Apply Settings & Reset Playground').click();
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
	await website.page.getByText('Apply Settings & Reset Playground').click();
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

test('should edit a file in the code editor and see changes in the viewport', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?storage=temp');

	// Open site manager
	await website.ensureSiteManagerIsOpen();

	// Navigate to File Browser tab
	await website.page.getByRole('tab', { name: 'File Browser' }).click();

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

	// Wait a moment for the change to be processed
	await website.page.waitForTimeout(500);

	// Save the file (Cmd+S or Ctrl+S)
	await website.page.keyboard.press(
		process.platform === 'darwin' ? 'Meta+S' : 'Control+S'
	);

	// Wait for save to complete (look for save indicator if there is one)
	await website.page.waitForTimeout(1000);

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

	// Open site manager
	await website.ensureSiteManagerIsOpen();

	// Navigate to Blueprint tab
	await website.page.getByRole('tab', { name: 'Blueprint' }).click();

	// Wait for CodeMirror editor to load
	const editor = website.page.locator(
		'[class*="blueprint-editor"] .cm-editor'
	);
	await editor.waitFor({ timeout: 10000 });

	// Create a simple blueprint that writes "Blueprint test" to index.php
	const blueprint = JSON.stringify(
		{
			landingPage: '/index.php',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/index.php',
					data: 'Blueprint test',
				},
			],
		},
		null,
		2
	);

	// Focus the editor
	await editor.click();
	// Wait a moment for the editor to be fully ready
	await website.page.waitForTimeout(100);

	// Select all existing content
	await website.page.keyboard.press(
		process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
	);

	// Delete the selected content
	await website.page.keyboard.press('Backspace');
	await website.page.waitForTimeout(100);

	// Use Playwright's fill method on the contenteditable .cm-content element
	// This is more reliable than character-by-character typing which triggers
	// auto-bracket insertion
	const cmContent = editor.locator('.cm-content');
	await cmContent.fill(blueprint);

	// Wait for validation to complete (linter has 300ms debounce)
	await website.page.waitForTimeout(500);

	// Verify the blueprint was inserted by checking the editor content
	await expect(cmContent).toContainText('writeFile', {
		timeout: 5000,
	});

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

	// Open site manager
	await website.ensureSiteManagerIsOpen();

	// Navigate to Blueprint tab
	await website.page.getByRole('tab', { name: 'Blueprint' }).click();

	// Wait for CodeMirror editor to load
	const editor = website.page.locator(
		'[class*="blueprint-editor"] .cm-editor'
	);
	await editor.waitFor({ timeout: 10000 });

	// Wait for the URL hash to be computed (debounced by 500ms in the component)
	// and the share button to be ready
	await website.page.waitForTimeout(1000);

	// Click the share button (copy link to blueprint)
	const shareButton = website.page.getByRole('button', {
		name: 'Copy link to blueprint',
	});
	await expect(shareButton).toBeVisible();
	await shareButton.click();

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

test('should make every Site Manager tab reachable on mobile', async ({
	website,
}) => {
	await website.page.setViewportSize({ width: 390, height: 844 });
	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	const siteManager = website.page.locator(
		'section[class*="site-info-panel"]'
	);
	await expect(siteManager).toBeVisible();

	const tabList = siteManager.locator('.components-tab-panel__tabs');
	await expect(tabList).toBeVisible();

	const logsTab = siteManager.getByRole('tab', { name: 'Logs' });
	await expect(logsTab).toHaveCount(1);

	await tabList.evaluate((element) => {
		const logsTab = Array.from(
			element.querySelectorAll<HTMLElement>('[role="tab"]')
		).find((tab) => tab.textContent?.trim() === 'Logs');
		if (!logsTab) {
			throw new Error('Logs tab not found');
		}

		logsTab.scrollIntoView({ block: 'nearest', inline: 'end' });
	});

	await expect(logsTab).toBeInViewport();
	await logsTab.click();
	await expect(logsTab).toHaveAttribute('aria-selected', 'true');
});

test.describe('Database panel', () => {
	test.beforeEach(async ({ website }) => {
		await website.goto('./?storage=temp');
		await website.ensureSiteManagerIsOpen();

		// Navigate to Database tab
		await website.page.getByRole('tab', { name: 'Database' }).click();

		// Verify the Database tab is active
		const databaseTab = website.page.getByRole('tab', { name: 'Database' });
		await expect(databaseTab).toHaveAttribute('aria-selected', 'true');
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
				const statusButton = [
					...document.querySelectorAll('[role="status"], button'),
				].find((node) => {
					const label = (node.textContent || '').trim();
					return (
						label === 'Autosaving' ||
						label === 'Saving' ||
						label === 'Autosaved' ||
						label === 'Saved Playground' ||
						label === 'Unsaved'
					);
				});
				if (!statusButton) {
					return;
				}
				(window as any).__saveStatusSamples.push({
					text: (statusButton.textContent || '').trim(),
					ariaLabel: statusButton.getAttribute('aria-label'),
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
			website.page.getByRole('button', { name: /Site Manager/ })
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
		await expect(
			website.page.getByText(/Autosaving|Finalizing autosave/)
		).toHaveCount(0);
		await expect(
			website.page.getByRole('button', { name: 'Unsaved' })
		).toHaveCount(0);
		const saveStatusSamples = await website.page.evaluate(() =>
			((window as any).__saveStatusSamples || []).filter(
				(
					sample: {
						text: string;
						ariaLabel: string | null;
						color: string;
					},
					index: number,
					all: {
						text: string;
						ariaLabel: string | null;
						color: string;
					}[]
				) => {
					const previous = all[index - 1];
					return (
						!previous ||
						previous.text !== sample.text ||
						previous.ariaLabel !== sample.ariaLabel ||
						previous.color !== sample.color
					);
				}
			)
		);
		const autosavingIndex = saveStatusSamples.findIndex(
			({ text }) => text === 'Autosaving'
		);
		const autosavedIndex = saveStatusSamples.findIndex(
			({ text }) => text === 'Autosaved'
		);
		expect(autosavingIndex).toBeGreaterThan(-1);
		expect(autosavedIndex).toBeGreaterThan(autosavingIndex);
		expect(
			saveStatusSamples.some(({ ariaLabel }) =>
				/^Autosaving [1-9]\d*%$/.test(ariaLabel ?? '')
			)
		).toBe(true);
	});

	test('should show intent-driven creation actions in the overlay', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`Saved-by-default Playgrounds rely on OPFS, which is not available in Playwright's ${browserName}.`
		);

		await website.goto(
			getUniqueSavedPlaygroundSetupUrl('creation-actions')
		);
		const siteSlugBeforeGitHubImport = new URL(
			website.page.url()
		).searchParams.get('site-slug');
		await website.openSavedPlaygroundsOverlay();
		await expect(
			website.page.getByRole('button', { name: 'New Playground' })
		).toBeVisible();
		await expect(
			website.page.getByRole('button', {
				name: 'Preview a WordPress PR',
			})
		).toBeVisible();
		await expect(
			website.page.getByRole('button', {
				name: 'Preview a Gutenberg PR',
			})
		).toBeVisible();
		await expect(
			website.page.getByRole('button', { name: 'Import from GitHub' })
		).toBeVisible();
		await expect(
			website.page.getByRole('button', {
				name: 'Open a Blueprint URL',
			})
		).toBeVisible();
		await expect(
			website.page.getByRole('button', { name: 'Import a .zip' })
		).toBeVisible();
		await expect(
			website.page.getByRole('button', { name: 'Unsaved Playground' })
		).toHaveCount(0);

		await website.page
			.getByRole('button', { name: 'Import from GitHub' })
			.click();
		await expect(
			website.page.getByRole('dialog', { name: 'Import from GitHub' })
		).toBeVisible();
		expect(new URL(website.page.url()).searchParams.get('site-slug')).toBe(
			siteSlugBeforeGitHubImport
		);
	});

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

		await website.openSavedPlaygroundsOverlay();
		const targetRow = website.page
			.locator('[class*="siteRow"]')
			.filter({ hasText: setup.targetName })
			.first();
		await targetRow.getByRole('button', { name: 'Site actions' }).click();
		await website.page.getByRole('menuitem', { name: 'Rename' }).click();

		const dialog = website.page.getByRole('dialog', {
			name: 'Rename Playground',
		});
		const newName = `Renamed Recovery ${Date.now()}`;
		await expect(
			dialog.getByRole('textbox', { name: /name/i })
		).toHaveValue(setup.targetName);
		await dialog.getByRole('textbox', { name: /name/i }).fill(newName);
		await dialog.getByRole('button', { name: 'Rename' }).click();
		await expect(dialog).not.toBeVisible();

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

		await website.openSavedPlaygroundsOverlay();
		await website.page
			.getByRole('button', { name: 'New Playground' })
			.click();
		const overlay = website.page
			.locator('[class*="overlay"]')
			.filter({ hasText: 'Playground' });
		await expect(overlay).not.toBeVisible({ timeout: 1000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page), {
				timeout: 120000,
			})
			.not.toMatchObject({ slug: firstSite.slug });
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const firstBlankSite = await getActivePlaygroundSite(website.page);

		await website.openSavedPlaygroundsOverlay();
		await website.page
			.getByRole('button', { name: 'New Playground' })
			.click();
		await expect(overlay).not.toBeVisible({ timeout: 1000 });
		await expect
			.poll(() => getActivePlaygroundSite(website.page), {
				timeout: 120000,
			})
			.not.toMatchObject({ slug: firstBlankSite.slug });
		await expect(
			website.page.getByText('Recent autosave available')
		).toHaveCount(0);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });

		await website.openSavedPlaygroundsOverlay();
		await website.page.evaluate(() => {
			(window as any).__siteSwitchStatusSamples = [];
			const sampleStatus = () => {
				const status = [
					...document.querySelectorAll('[role="status"], button'),
				]
					.map((node) => (node.textContent || '').trim())
					.find((text) =>
						[
							'Autosaving',
							'Saving',
							'Autosaved',
							'Saved Playground',
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
				name: new RegExp(`^${escapeRegExp(firstSite.name)}`),
			})
			.click();
		await expect(overlay).not.toBeVisible({ timeout: 1000 });
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
	});

	test('should show autosave browser storage details in the Site Manager by default', async ({
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
			website.page.getByText('Autosaved in this browser')
		).toBeVisible();
		await expect(
			website.page.getByText(
				'Removed after 5 newer autosaves unless saved.'
			)
		).toBeVisible();
		const siteInfoPanel = website.page.locator(
			'section[class*="site-info-panel"]'
		);
		await expect(
			siteInfoPanel.getByRole('button', { name: 'Store permanently' })
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
		await website.page
			.getByRole('button', { name: 'Store permanently' })
			.click();
		const dialog = website.page.getByRole('dialog', {
			name: 'Save Playground',
		});
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Save in this browser')).toBeVisible();
		await expect(
			dialog.getByText('Save to a local directory')
		).toBeVisible();
		await dialog.getByRole('button', { name: 'Save' }).click();

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
			website.page.getByText(/Autosaved|Autosaving|Finalizing autosave/)
		).toHaveCount(0);
		await expect(
			website.page.getByText(/Saved Playground|Saving|Finalizing save/)
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
		await website.page
			.getByRole('button', { name: 'Store permanently' })
			.click();
		const dialog = website.page.getByRole('dialog', {
			name: 'Save Playground',
		});
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByText('Save to a local directory (not available)')
		).toHaveCount(0, { timeout: 30000 });
		await dialog
			.getByRole('radio', { name: /Save to a local directory/ })
			.check({ force: true });
		await dialog.getByRole('button', { name: 'Choose...' }).click();
		await dialog.getByRole('button', { name: 'Save' }).click();

		await expect(dialog).not.toBeVisible({ timeout: 90000 });
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
		await expect(website.page.getByText('Saved Playground')).toBeVisible();
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
			website.page.getByText('Recent autosave available')
		).toBeVisible();
		await expect(
			website.page.getByText(
				/Another Playground was created .* from the same URL\./
			)
		).toBeVisible();
		await website.waitForNestedIframes();
		await expect(
			website.page.getByRole('button', { name: 'Unsaved' })
		).toBeVisible();
		await website.page
			.getByRole('button', { name: 'Restore Autosave' })
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
			website.page.getByText('Recent autosave available')
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
					...document.querySelectorAll('[role="status"], button'),
				]
					.map((node) => (node.textContent || '').trim())
					.find((text) =>
						[
							'Autosaving',
							'Saving',
							'Autosaved',
							'Saved Playground',
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
		await website.page.getByRole('button', { name: 'No, thanks' }).click();
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
		await expect(
			website.page.getByRole('button', { name: 'Unsaved' })
		).toBeVisible();
		await website.page.getByRole('button', { name: 'Unsaved' }).click();
		await expect(
			website.page.getByRole('button', { name: 'Store permanently' })
		).toHaveCount(0);
	});

	test('should show "Unsaved" status for storage=temp Playgrounds', async ({
		website,
	}) => {
		await website.goto('./?storage=temp');
		await website.ensureSiteManagerIsClosed();

		const indicator = website.page.getByRole('button', {
			name: 'Unsaved',
		});
		await expect(indicator).toBeVisible();
		await expect(indicator).toHaveCount(1);
		await indicator.click();
		const popoverDescription = website.page.getByText(
			'This Playground is not stored anywhere. Changes are lost when this page is refreshed or closed.'
		);
		await expect(popoverDescription).toBeVisible();
		await indicator.click();
		await expect(popoverDescription).toHaveCount(0);
		await indicator.click();
		await expect(popoverDescription).toBeVisible();
		const storePermanentlyButton = website.page.getByRole('button', {
			name: 'Store permanently',
		});
		const canStorePermanently = await website.page.evaluate(async () => {
			try {
				await navigator.storage.getDirectory();
				return true;
			} catch {
				return Boolean((window as any).showDirectoryPicker);
			}
		});
		if (canStorePermanently) {
			await storePermanentlyButton.click();
			await expect(
				website.page.getByRole('dialog', { name: 'Save Playground' })
			).toBeVisible();
		} else {
			await expect(storePermanentlyButton).toHaveCount(0);
		}
		expect(new URL(website.page.url()).searchParams.get('storage')).toBe(
			'temp'
		);
	});

	test('should see save playground message in the Site Manager for storage=temp Playgrounds', async ({
		website,
	}) => {
		await website.goto('./?storage=temp');
		await website.ensureSiteManagerIsOpen();

		const indicator = website.page.getByText(
			'This is an Unsaved Playground. Your changes will be lost on page refresh.'
		);

		await expect(indicator).toBeVisible();
		await expect(indicator).toHaveCount(1);
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
			website.page.getByText('Recent autosave available')
		).toBeVisible();

		// Regression: saving the temporary Playground before answering the
		// restore nudge must not be undone when the nudge is dismissed.
		await website.page.getByRole('button', { name: 'Unsaved' }).click();
		await website.page
			.getByRole('button', { name: 'Store permanently' })
			.click();

		const saveDialog = website.page.getByRole('dialog', {
			name: 'Save Playground',
		});
		await expect(saveDialog).toBeVisible();
		await saveDialog.getByRole('button', { name: 'Save' }).click();
		await expect(saveDialog).not.toBeVisible({ timeout: 120000 });
		await website.page.waitForFunction(() => {
			const api = (window as any).playgroundSites;
			const activeSite = api?.list().find((site: any) => site.isActive);
			return (
				activeSite?.storage === 'opfs' &&
				activeSite?.persistence === 'explicit'
			);
		});

		const keepNewButton = website.page.getByRole('button', {
			name: 'No, thanks',
		});
		// Saving may route directly to the saved Playground and clear the
		// nudge. If it stays visible, dismissing it must not undo the save.
		if (await keepNewButton.isVisible()) {
			await keepNewButton.click();
		}
		await expect(
			website.page.getByText('Recent autosave available')
		).toHaveCount(0);
		await expect(website.page.getByText('Saved Playground')).toBeVisible();
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
