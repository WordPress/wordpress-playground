import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';
import {
	PHPMYADMIN_CONFIG_PATH,
	PHPMYADMIN_INSTALL_PATH,
	PHPMYADMIN_URL_PATH,
} from '@wp-playground/tools';

test('should open and close the Site Tools panel', async ({ website }) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();
	await expect(
		website.page.getByRole('heading', { name: 'Site Tools' })
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: /Close Site Tools/ })
	).toBeVisible();

	await website.ensureSiteToolsIsClosed();
	await expect(
		website.page.getByRole('button', { name: /Open Site Tools/ })
	).toBeVisible();
});

test('should show app, backup, and troubleshooting tools', async ({
	website,
}) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();

	await expect(
		website.page.getByRole('heading', {
			name: 'Installing apps has moved here:',
		})
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: /App Launcher/ })
	).toBeVisible();
	await expect(
		website.page.getByRole('heading', { name: 'Backup' })
	).toBeVisible();
	await expect(
		website.page.getByRole('heading', { name: 'Troubleshooting' })
	).toBeVisible();

	await website.page.getByRole('button', { name: 'start over' }).click();
	await expect(
		website.page.getByRole('button', { name: 'Delete everything' })
	).toBeVisible();
	await website.page
		.getByRole('button', { name: 'enter recovery mode' })
		.click();
	await expect(
		website.page.getByRole('link', {
			name: 'Install Health Check & Troubleshoot',
		})
	).toBeVisible();
	await expect(
		website.page.getByRole('link', {
			name: 'Install Health Check & Troubleshoot',
		})
	).toHaveAttribute('href', /playground-recovery-mode=health-check/);
	await expect(
		website.page.getByRole('link', {
			name: 'Install Health Check & Troubleshoot',
		})
	).not.toHaveAttribute('href', /blueprint-url=/);
});

test('should close the Site Tools panel with its close button', async ({
	website,
}) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();
	await expect(
		website.page.getByRole('button', { name: /App Launcher/ })
	).toBeVisible();

	await website.page
		.getByRole('button', { name: /Close Site Tools/ })
		.click();
	await expect(
		website.page.getByRole('button', { name: /App Launcher/ })
	).not.toBeVisible();
});

test('should display the page title as "My WordPress"', async ({ website }) => {
	await website.goto('./');
	await expect(website.page).toHaveTitle('My WordPress');
});

test('should navigate within WordPress from Site Tools shortcuts', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();
	await website.page.getByRole('button', { name: 'WP Admin' }).click();
	await expect(website.page).toHaveURL(/\/wp-admin\/$/);
	await expect(
		wordpress.getByRole('heading', { name: 'Dashboard', level: 1 })
	).toBeVisible();

	await website.page.getByRole('button', { name: 'Homepage' }).click();
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
	await expect(
		wordpress.locator('a[href$="/my-apps/?recipes"]')
	).toBeVisible();
});

test('should open phpMyAdmin from the Database tools', async ({
	website,
	context,
}) => {
	const probeText = 'phpMyAdmin path alias works';
	const blueprint: Blueprint = {
		steps: [
			{
				step: 'mkdir',
				path: PHPMYADMIN_INSTALL_PATH,
			},
			{
				step: 'writeFile',
				path: `${PHPMYADMIN_INSTALL_PATH}/index.php`,
				data: `<?php echo ${JSON.stringify(probeText)};`,
			},
			{
				step: 'writeFile',
				path: PHPMYADMIN_CONFIG_PATH,
				data: '<?php',
			},
		],
	};
	await website.goto(`./#${JSON.stringify(blueprint)}`);

	await website.ensureSiteToolsIsOpen();
	// The Database tab is a developer tool and only appears once the
	// "Show developer tools" switch on the Advanced tab is turned on.
	const databaseTab = website.page.getByRole('tab', { name: 'Database' });
	await expect(databaseTab).toHaveCount(0);
	await website.page.getByRole('tab', { name: 'Advanced' }).click();
	await website.page
		.getByRole('checkbox', { name: 'Show developer tools' })
		.check();
	await databaseTab.click();

	const phpMyAdminButton = website.page.getByRole('button', {
		name: 'Open phpMyAdmin',
	});
	await expect(phpMyAdminButton).toBeEnabled();

	const popupPromise = context.waitForEvent('page');
	await phpMyAdminButton.click();
	const popup = await popupPromise;

	await popup.waitForLoadState();
	expect(new URL(popup.url()).pathname).toContain(PHPMYADMIN_URL_PATH);
	await expect(popup.locator('body')).toContainText(probeText);
});
