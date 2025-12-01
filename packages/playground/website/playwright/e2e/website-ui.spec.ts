import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';

// We can't import the SupportedPHPVersions versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SupportedPHPVersions } from '../../../../php-wasm/universal/src/lib/supported-php-versions.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

test('should reflect the URL update from the navigation bar in the WordPress site', async ({
	website,
}) => {
	await website.goto('./?url=/wp-admin/');
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
	await website.goto('./?url=/wp-admin');
	await website.ensureSiteManagerIsClosed();
	await expect(website.page.locator('input[value="/wp-admin/"]')).toHaveValue(
		'/wp-admin/'
	);
});

SupportedPHPVersions.forEach(async (version) => {
	test(`should switch PHP version to ${version}`, async ({ website }) => {
		await website.goto(`./`);
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
			await website.goto('./');
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
	await website.goto('./');
	await website.ensureSiteManagerIsOpen();
	await expect(website.page.getByLabel('Network access')).toBeChecked();
});

test('should display networking as active when networking is enabled', async ({
	website,
}) => {
	await website.goto('./?networking=yes');
	await website.ensureSiteManagerIsOpen();
	await expect(website.page.getByLabel('Network access')).toBeChecked();
});

test('should enable networking when requested', async ({ website }) => {
	await website.goto('./');

	await website.ensureSiteManagerIsOpen();
	await website.page.getByLabel('Network access').check();
	await website.page.getByText('Apply Settings & Reset Playground').click();
	await website.ensureSiteManagerIsClosed();
	await website.ensureSiteManagerIsOpen();

	await expect(website.page.getByLabel('Network access')).toBeChecked();
});

test('should disable networking when requested', async ({ website }) => {
	await website.goto('./?networking=yes');

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
	await website.goto(`./#${JSON.stringify(blueprint)}`);

	await expect(wordpress.locator('body')).toContainText(
		'This is a fatal error'
	);
});

test('should keep query arguments when updating settings', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?url=/wp-admin/&php=8.0&wp=6.6');

	expect(website.page.url()).toContain('?url=%2Fwp-admin%2F&php=8.0&wp=6.6');
	expect(
		await wordpress.locator('body').evaluate((body) => body.baseURI)
	).toMatch('/wp-admin/');

	await website.ensureSiteManagerIsOpen();
	await website.page.getByLabel('Network access').check();
	await website.page.getByText('Apply Settings & Reset Playground').click();
	await website.waitForNestedIframes();

	expect(website.page.url()).toMatch(
		'?url=%2Fwp-admin%2F&php=8.0&wp=6.6&networking=yes'
	);
	expect(
		await wordpress.locator('body').evaluate((body) => body.baseURI)
	).toMatch('/wp-admin/');
});

test('should edit a file in the code editor and see changes in the viewport', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');

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
	await website.goto('./');

	// Open site manager
	await website.ensureSiteManagerIsOpen();

	// Navigate to Blueprint tab
	await website.page.getByRole('tab', { name: 'Blueprint' }).click();

	// Wait for CodeMirror editor to load
	const editor = website.page.locator(
		'[class*="blueprint-editor"] .cm-editor'
	);
	await editor.waitFor({ timeout: 10000 });

	await editor.click();

	// Delete all content in the editor (Cmd+A or Ctrl+A)
	await website.page.keyboard.press(
		process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
	);

	await website.page.keyboard.press('Backspace');
	await website.page.waitForTimeout(200);

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

	// Type the new blueprint with a delay between keystrokes
	await website.page.keyboard.type(blueprint, { delay: 50 });

	// Remove the autoinserted brackets until the end of the Blueprint
	await website.page.keyboard.down('Shift');
	for (let i = 0; i < 4; i++) {
		await website.page.keyboard.press('ArrowDown');
	}

	// Delete the selected lines
	await website.page.keyboard.press('Backspace');

	// Wait a moment for the change to be processed
	await website.page.waitForTimeout(500);

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

test.describe('Database panel', () => {
	test.beforeEach(async ({ website }) => {
		await website.goto('./');
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
			name: /Open Adminer/i,
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
			name: /Open phpMyAdmin/i,
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

		// Browse the "wp_posts" table
		const wpPostsRow = newPage
			.locator('tr')
			.filter({ hasText: 'wp_posts' })
			.first();
		await expect(wpPostsRow).toBeVisible({ timeout: 10000 });
		await wpPostsRow.getByRole('link', { name: 'Browse' }).click();
		await newPage.waitForLoadState();
		const pmaRows = newPage.locator('table.table_results tbody tr');
		await expect(pmaRows.first()).toContainText('Welcome to WordPress.');

		// Click "edit" on a row
		await pmaRows
			.first()
			.getByRole('link', { name: 'Edit' })
			.first()
			.click();
		await newPage.waitForLoadState();
		const pmaForm = newPage.locator(
			'form#insertForm, form[name="insertForm"]'
		);
		await expect(pmaForm).toBeVisible({ timeout: 10000 });
		await expect(pmaForm).toContainText('Welcome to WordPress.');

		// Update the post content
		const postContentRow = pmaForm
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
