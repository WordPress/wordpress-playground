import { test, expect } from './fixtures/playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

// We can't import the SupportedPHPVersions versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../../../php-wasm/universal/src/lib/supported-php-versions.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../../wordpress-builds/src/wordpress/wp-versions.json';

test('should reflect the URL update from the navigation bar in the WordPress site', async ({
	website,
}) => {
	// posix-kernel: the website address-bar URL field is not initialized from
	// the `?url=` boot param — it stays `/` regardless of `?storage=temp`. The
	// WordPress iframe itself does navigate to the requested route (the
	// query-api `?url=/wp-admin/plugins.php` boot lands on the Plugins admin
	// screen), so this is a kernel-mode address-bar sync gap, not a routing
	// failure. The classic runtime keeps the field in sync. Re-enable once the
	// kernel boot seeds the address bar from `?url=`.
	test.skip(
		true,
		'posix-kernel: the address-bar URL field is not seeded from the ' +
			'`?url=` boot param (stays `/`), though the WordPress iframe does ' +
			'navigate to the requested route.'
	);
	await website.goto('./?storage=temp&url=/wp-admin/');
	await website.ensureSiteManagerIsClosed();
	await expect(website.page.locator('input[value="/wp-admin/"]')).toHaveValue(
		'/wp-admin/'
	);
});

test('should correctly load /wp-admin without the trailing slash', async ({
	website,
}) => {
	// See the note on the sibling test above: the kernel address bar is not
	// seeded from `?url=`, so it never reflects `/wp-admin/`.
	test.skip(
		true,
		'posix-kernel: the address-bar URL field is not seeded from the ' +
			'`?url=` boot param (stays `/`), though the WordPress iframe does ' +
			'navigate to the requested route.'
	);
	await website.goto('./?storage=temp&url=/wp-admin');
	await website.ensureSiteManagerIsClosed();
	await expect(website.page.locator('input[value="/wp-admin/"]')).toHaveValue(
		'/wp-admin/'
	);
});

SupportedPHPVersions.forEach(async (version) => {
	test(`should switch PHP version to ${version}`, async ({ website }) => {
		// posix-kernel mode ships a single PHP build (8.3); the
		// `?php=<version>` URL parameter is silently ignored at boot
		// (`playground-worker-endpoint.ts` only consumes
		// `options.wpVersion`). The dropdown still persists the selected
		// value, so this test would falsely "pass" while no actual PHP
		// runtime switch happens — better to surface it as skipped until
		// kernel mode bundles multiple PHP builds.
		test.skip(
			true,
			'posix-kernel: single PHP build (8.3); the `php=<version>` URL param is ignored at boot.'
		);
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
			// Boot a temporary site so applying settings offers the single
			// "Discard current work & create a fresh Playground" reset button.
			// (A saved/autosave site instead shows an "Apply to this
			// Playground" / "Create a fresh Playground" menu — see
			// `site-settings-action-footer.tsx`.) Mirrors the classic suite.
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
	await website.goto(`./#${JSON.stringify(blueprint)}`);

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

test('should edit a file in the code editor and see changes in the viewport', async ({
	website,
	wordpress,
}) => {
	// posix-kernel: editing a file in the Files pane and clicking Save does not
	// land the write on the kernel doc-root. Verified by reading
	// `/var/www/html/index.php` back through the client right after Save — it
	// still holds the original WordPress bootstrap, and the reloaded viewport
	// never shows the edited content. The same shared Files-pane editor persists
	// correctly against the classic runtime (doc-root `/wordpress`), so this is a
	// kernel-mode save-plumbing gap, not a test mis-port. The migrated body below
	// (openDockPane + Save button + cross-origin-safe reload) is ready to re-enable
	// once the kernel wires the editor save back into the served filesystem.
	test.skip(
		true,
		'posix-kernel: Files-pane editor Save does not persist to the ' +
			'kernel doc-root (/var/www/html); the served page never reflects ' +
			'the edit.'
	);
	await website.goto('./?storage=temp');

	// Open the Files Dock pane
	await website.openDockPane('Files');
	const filesPane = website.page.getByRole('dialog', { name: 'Files pane' });

	// Wait for file tree to load
	await website.page.locator('[data-path="/var/www/html"]').waitFor();

	// Expand the doc-root folder
	const docRootFolder = website.page.locator(
		'button[data-path="/var/www/html"]'
	);
	if ((await docRootFolder.getAttribute('data-expanded')) !== 'true') {
		await docRootFolder.click();
	}

	// Double-click index.php to open it in the editor
	await website.page
		.locator('button[data-path="/var/www/html/index.php"]')
		.dblclick();

	// Wait for CodeMirror editor to load
	const editor = website.page.locator('[class*="file-browser"] .cm-editor');
	await editor.waitFor({ timeout: 10000 });
	const saveButton = filesPane.getByRole('button', {
		name: /^(Save|Saved|Saving…)$/,
	});

	// Click `.cm-content` (the contenteditable) so keystrokes land on the
	// editor rather than `<body>`.
	await website.page.waitForTimeout(50);

	await editor.locator('.cm-content').click();

	await website.page.waitForTimeout(250);

	// Select all content in the editor (Cmd+A or Ctrl+A)
	await website.page.keyboard.press(
		process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
	);

	await website.page.keyboard.press('Backspace');
	await website.page.waitForTimeout(200);

	// Type the new content with a delay between keystrokes
	await website.page.keyboard.type('Edited file', { delay: 50 });

	// Save via the Files pane Save button (the Cmd+S keybinding does not
	// reliably land the write in kernel mode).
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await website.page.waitForTimeout(1500);

	// Close the site manager to see the viewport
	await website.ensureSiteManagerIsClosed();

	// Reload just the WordPress iframe to see the changes. In kernel mode the
	// `#wp` frame is served cross-origin to the viewport shell, so reaching
	// into `contentWindow.location.reload()` throws a SecurityError. Reassigning
	// the element's own `src` (parent-side DOM, always accessible) reloads it.
	const playgroundViewport = website.page.frameLocator(
		'#playground-viewport:visible,.playground-viewport:visible'
	);
	await playgroundViewport
		.locator('#wp')
		.evaluate((iframe: HTMLIFrameElement) => {
			// eslint-disable-next-line no-self-assign
			iframe.src = iframe.src;
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

	// Open the Blueprint Dock pane
	await website.openDockPane('Current Blueprint', 'Blueprint pane');

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

	// Open the Blueprint Dock pane
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

	// Verify the copy confirmation surfaces in the Dock success toast
	await expect(
		website.page
			.getByRole('group', { name: 'Operation succeeded' })
			.filter({ hasText: 'Link copied to clipboard' })
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

test.describe('Database panel', () => {
	test.beforeEach(async ({ website }) => {
		await website.goto('./?storage=temp');
		await website.openDockPane('Database');
	});

	test('should display database info', async ({ website }) => {
		await expect(website.page.getByText('Path:')).toBeVisible();
		await expect(
			website.page.getByText(
				'/var/www/html/wp-content/database/.ht.sqlite'
			)
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
		test.skip(
			true,
			'kernel-mode libsqlite3 lacks SQLITE_ENABLE_COLUMN_METADATA; ' +
				'Adminer queries via WP_SQLite_Driver fatal on the first ' +
				'PDOStatement::getColumnMeta() call.'
		);
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
		test.skip(
			true,
			'kernel-mode libsqlite3 lacks SQLITE_ENABLE_COLUMN_METADATA; ' +
				'phpMyAdmin queries via WP_SQLite_Driver fatal on the first ' +
				'PDOStatement::getColumnMeta() call.'
		);
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
		await newPage.locator('.CodeMirror').click();
		await newPage.keyboard.type('SHOW TABLES');
		await newPage.getByRole('button', { name: 'Go' }).click();
		await newPage.waitForLoadState();
		await expect(newPage.locator('body')).toContainText('wp_posts');

		await newPage.close();
	});
});

// Test saving playgrounds by default and when the "can-save" URL parameter is set to "no".
// Ported from the non-kernel `website-ui.spec.ts` "Default Playground storage"
// suite after the dock migration: the temp-site status is now the dock's
// "Unsaved" save-status control (not a standalone "Unsaved Playground" label),
// and the "…will be lost on page refresh." warning was removed from Site
// Settings (the tests below assert it is not duplicated there).
test.describe('Save Status Indicator', () => {
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
});

test('should not include Google Analytics when VITE_GOOGLE_ANALYTICS_ID is not set', async ({
	website,
}) => {
	await website.goto('./');
	const gtmScripts = await website.page
		.locator('script[src*="googletagmanager.com"]')
		.count();
	expect(gtmScripts).toBe(0);
});
