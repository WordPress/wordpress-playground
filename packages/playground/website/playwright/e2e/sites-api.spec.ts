import { test, expect } from '../playground-fixtures';

test('window.playgroundSites is exposed after boot', async ({ website }) => {
	await website.goto('./');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);
});

test('playgroundSites.list() returns the active site', async ({ website }) => {
	await website.goto('./');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const sites = await website.page.evaluate(() =>
		(window as any).playgroundSites.list()
	);
	expect(sites.length).toBeGreaterThanOrEqual(1);
	const active = sites.find((s: any) => s.isActive);
	expect(active).toBeTruthy();
	expect(active.slug).toBeTruthy();
	expect(active.storage).toBe('temporary');
});

test('playgroundSites.saveInBrowser() persists a temporary site', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const result = await website.page.evaluate(() =>
		(window as any).playgroundSites.saveInBrowser()
	);
	expect(result.slug).toBeTruthy();
	expect(result.storage).toBe('opfs');
});

test('playgroundSites.rename() renames a saved site', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const newName = await website.page.evaluate(async () => {
		const api = (window as any).playgroundSites;
		await api.saveInBrowser();
		const name = 'Renamed Via API';
		await api.rename(name);
		const sites = api.list();
		const active = sites.find((s: any) => s.isActive);
		return active?.name;
	});
	expect(newName).toBe('Renamed Via API');
});

test('playgroundSites.getClient() returns a playground client', async ({
	website,
}) => {
	await website.goto('./');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const hasClient = await website.page.evaluate(() => {
		const client = (window as any).playgroundSites.getClient();
		return client != null;
	});
	expect(hasClient).toBe(true);
});
