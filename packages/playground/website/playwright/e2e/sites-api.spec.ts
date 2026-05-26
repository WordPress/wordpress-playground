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
	// Storage-specific behavior is covered below. This test only checks that
	// the list exposes the active Playground through the public API shape.
	expect(['opfs', 'local-fs', 'temporary']).toContain(active.storage);
});

test('playgroundSites.saveInBrowser() persists a temporary site', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./?storage=temp');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const result = await website.page.evaluate(() =>
		(window as any).playgroundSites.saveInBrowser()
	);
	expect(result.slug).toBeTruthy();
	expect(result.storage).toBe('opfs');
});

test('playgroundSites.autosaveTemporarySite() persists without disrupting the tab', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./?storage=temp');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const result = await website.page.evaluate(async () => {
		const api = (window as any).playgroundSites;
		const beforeUrl = window.location.href;
		const beforeClient = api.getClient();
		const beforeActive = api.list().find((s: any) => s.isActive);
		const saveResult = await api.autosaveTemporarySite();
		const afterActive = api.list().find((s: any) => s.isActive);
		return {
			beforeSlug: beforeActive?.slug,
			saveResult,
			afterActive,
			sameClient: beforeClient === api.getClient(),
			sameUrl: window.location.href === beforeUrl,
		};
	});

	// Autosave should promote the active temporary site to browser storage
	// without changing the visible URL or replacing the running Playground.
	expect(result.saveResult.slug).toBe(result.beforeSlug);
	expect(result.saveResult.storage).toBe('opfs');
	expect(result.afterActive.storage).toBe('opfs');
	expect(result.afterActive.persistence).toBe('autosave');
	expect(result.sameClient).toBe(true);
	expect(result.sameUrl).toBe(true);
});

test('playgroundSites.createNewSavedSite() creates an explicit OPFS site by default', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./?storage=temp');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const result = await website.page.evaluate(async () => {
		const api = (window as any).playgroundSites;
		const beforeUrl = window.location.href;
		const slug = await api.createNewSavedSite(
			'api-created-site',
			{ phpVersion: '8.3' },
			{ updateUrl: false }
		);
		const active = api.list().find((s: any) => s.isActive);
		return {
			slug,
			active,
			sameUrl: window.location.href === beforeUrl,
			hasClient: api.getClient() != null,
		};
	});

	// The new API creates a saved site record, boots it, and marks it as an
	// explicit save unless the caller opts into autosave persistence.
	expect(result.slug).toBe('api-created-site');
	expect(result.active.slug).toBe('api-created-site');
	expect(result.active.storage).toBe('opfs');
	expect(result.active.persistence).toBe('explicit');
	expect(result.hasClient).toBe(true);
	expect(result.sameUrl).toBe(true);
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
		const name = 'Renamed Via API';
		await api.saveInBrowser();
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
