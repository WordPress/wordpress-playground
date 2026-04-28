import { test, expect } from '../playground-fixtures.ts';
import type { Page } from '@playwright/test';

// OPFS tests must run serially because OPFS storage is shared at the browser
// level, so tests can interfere with each other's saved sites in parallel.
test.describe.configure({ mode: 'serial' });

async function saveSiteViaModal(page: Page, customName: string) {
	await page.getByRole('button', { name: 'Save site locally' }).click();

	const dialog = page.getByRole('dialog', { name: 'Save Playground' });
	await expect(dialog).toBeVisible({ timeout: 10000 });

	const nameInput = dialog.getByLabel('Playground name');
	await nameInput.fill('');
	await nameInput.type(customName);

	await dialog.getByText('Save in this browser').waitFor();
	await dialog.getByText('Save in this browser').click({ force: true });
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).not.toBeVisible({ timeout: 60000 });
}

async function runPlaygroundPhp<T>(page: Page, code: string): Promise<T> {
	const text = await page.evaluate(async (phpCode) => {
		const playground = (window as any).playground;
		const result = await playground.run({ code: phpCode });
		return result.text;
	}, code);
	return JSON.parse(text) as T;
}

test('OPFS SQLite snapshot excludes sidecars and restores a valid database', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);
	test.setTimeout(180000);

	const marker = `opfs-sqlite-snapshot-${Date.now()}`;
	await website.goto('./');
	await website.page.waitForFunction(
		() => Boolean((window as any).playground),
		{ timeout: 120000 }
	);

	const baseline = await runPlaygroundPhp<{ count: number }>(
		website.page,
		`<?php
require_once '/wordpress/wp-load.php';
for ($i = 0; $i < 25; $i++) {
	wp_insert_post(array(
		'post_title' => '${marker}-baseline-' . $i,
		'post_status' => 'publish',
	));
}
global $wpdb;
$count = (int) $wpdb->get_var(
	"SELECT COUNT(*) FROM $wpdb->posts WHERE post_title LIKE '${marker}-baseline-%'"
);
echo json_encode(array('count' => $count));
`
	);
	expect(baseline.count).toBeGreaterThanOrEqual(25);

	await website.page.evaluate(async () => {
		const playground = (window as any).playground;
		await playground.writeFile(
			'/wordpress/wp-content/database/.ht.sqlite-shm',
			'stale sqlite sidecar'
		);
	});

	await website.ensureSiteManagerIsOpen();
	await saveSiteViaModal(website.page, `OPFS SQLite Snapshot ${marker}`);
	await expect(website.page.getByLabel('Playground title')).toContainText(
		`OPFS SQLite Snapshot ${marker}`,
		{ timeout: 90000 }
	);

	const siteSlug = new URL(website.page.url()).searchParams.get('site-slug');
	if (!siteSlug) {
		throw new Error('Expected saved OPFS site URL to include site-slug.');
	}

	const opfsDatabaseEntries = await website.page.evaluate(async (slug) => {
		const root = await navigator.storage.getDirectory();
		const sites = await root.getDirectoryHandle('sites');
		const site = await sites.getDirectoryHandle(`site-${slug}`);
		const wpContent = await site.getDirectoryHandle('wp-content');
		const database = await wpContent.getDirectoryHandle('database');
		const entries: string[] = [];
		for await (const [name] of database.entries()) {
			entries.push(name);
		}
		return entries.sort();
	}, siteSlug);
	expect(opfsDatabaseEntries).toContain('.ht.sqlite');
	expect(opfsDatabaseEntries).not.toContain('.ht.sqlite-shm');

	await website.page.reload();
	await website.waitForNestedIframes();
	await website.page.waitForFunction(
		() => Boolean((window as any).playground),
		{ timeout: 120000 }
	);

	const restored = await runPlaygroundPhp<{
		integrity: string;
		baselineCount: number;
	}>(
		website.page,
		`<?php
require_once '/wordpress/wp-load.php';
global $wpdb;
$pdo = $GLOBALS['@pdo'];
$integrity = $pdo->query('PRAGMA integrity_check')->fetchColumn();
$baseline_count = (int) $wpdb->get_var(
	"SELECT COUNT(*) FROM $wpdb->posts WHERE post_title LIKE '${marker}-baseline-%'"
);
echo json_encode(array(
	'integrity' => $integrity,
	'baselineCount' => $baseline_count,
));
`
	);

	expect(restored.integrity).toBe('ok');
	expect(restored.baselineCount).toBeGreaterThanOrEqual(baseline.count);

	await website.page.evaluate(async () => {
		await (window as any).playground.goTo('/?p=1');
	});
	await expect(wordpress.locator('body')).not.toContainText(
		/Error establishing a database connection|database error/i
	);
});
