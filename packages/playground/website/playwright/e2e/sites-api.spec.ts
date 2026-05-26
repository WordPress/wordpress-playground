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

test('playgroundSites.isReady() resolves once the active site is ready', async ({
	website,
}) => {
	await website.goto('./');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites)
	);

	const ready = await website.page.evaluate(async () => {
		await (window as any).playgroundSites.isReady();
		// After isReady() resolves, getClient() must return a usable client.
		const client = (window as any).playgroundSites.getClient();
		return client != null;
	});
	expect(ready).toBe(true);
});

test('playgroundSites.isReady() waits when the client is not in the store yet', async ({
	page,
}) => {
	// Install a setter on window.playgroundSites BEFORE the app runs.
	// The setter captures the moment of exposure and snapshots the client
	// state so we can prove the test really hit the "not yet ready" path.
	await page.addInitScript(() => {
		let api: any;
		Object.defineProperty(window, 'playgroundSites', {
			configurable: true,
			get() {
				return api;
			},
			set(v) {
				api = v;
				let clientAtExposure: unknown = 'missing';
				try {
					clientAtExposure = v?.getClient();
				} catch (e) {
					clientAtExposure = `THREW:${(e as Error).message}`;
				}
				(window as any).__sitesApiExposure = {
					hadClientAtExposure:
						clientAtExposure != null &&
						typeof clientAtExposure !== 'string',
					exposureSnapshot: String(clientAtExposure),
				};
			},
		});
	});
	await page.goto('./');
	await page.waitForFunction(() => Boolean((window as any).playgroundSites));

	const result = await page.evaluate(async () => {
		const api = (window as any).playgroundSites;
		const exposure = (window as any).__sitesApiExposure;
		const t0 = performance.now();
		await api.isReady();
		const isReadyMs = performance.now() - t0;
		const clientAfter = api.getClient();
		return {
			hadClientAtExposure: exposure?.hadClientAtExposure,
			exposureSnapshot: exposure?.exposureSnapshot,
			isReadyMs,
			hasClientAfter: clientAfter != null,
		};
	});

	// The test is only meaningful if we actually caught the unready window.
	expect(result.hadClientAtExposure).toBe(false);
	// After isReady() resolves, the client must be present.
	expect(result.hasClientAfter).toBe(true);
	// And isReady() must not have returned instantly — it had to wait for
	// the boot to finish.
	expect(result.isReadyMs).toBeGreaterThan(50);
});
