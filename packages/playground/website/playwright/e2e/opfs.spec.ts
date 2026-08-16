import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';
import type { BrowserContext, Page } from '@playwright/test';
import { encodeZip, collectBytes } from '@php-wasm/stream-compression';
import { joinPaths } from '@php-wasm/util';
import { getDirectoryNameForSlug } from '../../src/lib/state/opfs/opfs-site-path';
import { readFile } from 'node:fs/promises';

/**
 * Creates a minimal WordPress export ZIP file for testing imports.
 * The ZIP contains just one marker file with the given marker content.
 */
async function createTestWordPressZip(
	markerContent: string,
	markerPath = 'wp-content/index.php',
	additionalFiles: File[] = []
): Promise<Buffer> {
	const encodedMarker = Buffer.from(markerContent).toString('base64');
	const phpContent = `<?php echo base64_decode('${encodedMarker}');`;
	const file = new File([phpContent], markerPath, {
		type: 'text/plain',
	});
	const zipStream = encodeZip([file, ...additionalFiles]);
	const zipBytes = await collectBytes(zipStream);
	return Buffer.from(zipBytes!);
}

/**
 * Drops a ZIP through the page-level import target.
 *
 * By default, also confirms a transient dragleave does not dismiss the overlay.
 */
async function dropZipFile(
	page: Page,
	name: string,
	zipBuffer: Buffer,
	verifyDragLeaveStability = true
) {
	const dataTransfer = await page.evaluateHandle(
		(file) => {
			const bytes = Uint8Array.from(atob(file.base64), (character) =>
				character.charCodeAt(0)
			);
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(
				new File([bytes], file.name, { type: 'application/zip' })
			);
			return dataTransfer;
		},
		{ name, base64: zipBuffer.toString('base64') }
	);
	await expect(
		page.getByRole('button', { name: /Drop a Playground ZIP here/ })
	).toBeVisible();
	const pane = page.getByRole('dialog', { name: 'New Playground pane' });
	const paneText = await pane.innerText();
	const pageBody = page.locator('body');
	const overlay = page.locator('[data-cy="zip-drop-overlay"]');
	await expect
		.poll(async () => {
			await pageBody.dispatchEvent('dragenter', { dataTransfer });
			return overlay.isVisible();
		})
		.toBe(true);
	await expect
		.poll(() =>
			overlay.evaluate((element) => {
				const bounds = element.getBoundingClientRect();
				const hitTarget = document.elementFromPoint(
					bounds.left + bounds.width / 2,
					bounds.top + bounds.height / 2
				);
				return element.contains(hitTarget);
			})
		)
		.toBe(true);
	expect(await pane.innerText()).toBe(paneText);
	if (verifyDragLeaveStability) {
		await pageBody.dispatchEvent('dragleave', { dataTransfer });
		await pageBody.dispatchEvent('dragenter', { dataTransfer });
		await page.waitForTimeout(75);
		await expect(
			page.locator('[data-cy="zip-drop-overlay"]')
		).toBeVisible();
	}
	await overlay.dispatchEvent('dragover', { dataTransfer });
	await overlay.dispatchEvent('drop', { dataTransfer });
	await dataTransfer.dispose();
}

async function createPluginThemeExportZip(): Promise<Buffer> {
	const files = [
		new File(
			[
				`<?php
/**
 * Plugin Name: Close Race Plugin
 */
`,
			],
			'wp-content/plugins/close-race-plugin/close-race-plugin.php'
		),
		new File(
			[
				`/*
Theme Name: Close Race Theme
*/
`,
			],
			'wp-content/themes/close-race-theme/style.css'
		),
		new File(
			[`<?php echo 'Close Race Theme';`],
			'wp-content/themes/close-race-theme/index.php'
		),
	];
	const progressFileContents = new Uint8Array(8 * 1024);
	for (let index = 0; index < 5000; index++) {
		files.push(
			new File(
				[progressFileContents],
				`wp-content/uploads/import-progress-${index}.bin`
			)
		);
	}
	const zipStream = encodeZip(files);
	const zipBytes = await collectBytes(zipStream);
	return Buffer.from(zipBytes!);
}

/**
 * Returns a URL that opts this test out of default browser storage.
 *
 * `storage=temp` is what makes the site temporary. The random value keeps
 * repeated navigations from reusing a temporary site created earlier in this
 * ordered OPFS test file.
 */
function getTemporaryPlaygroundUrl(hash = '') {
	return `./?storage=temp&random=${Math.random().toString(36).slice(2)}${hash}`;
}

const OPFS_CLEANUP_LOCK_HOLDER_KEY = 'simulate-opfs-cleanup-lock-holder';
const OPFS_CLEANUP_FAILURE_COUNT_KEY = 'opfs-cleanup-failure-count';

/**
 * Makes OPFS file removal fail while another test tab is marked as open.
 *
 * Chromium does not give us a reliable way to force a real OPFS lock in CI.
 * This patch creates the same kind of failure the boot code sees: removing an
 * old file rejects until the other tab closes. Closing the holder tab removes
 * the marker through `beforeunload`/`pagehide`, so the next retry can succeed.
 */
async function simulateOpfsCleanupBlockedByAnotherTab(context: BrowserContext) {
	await context.addInitScript(
		({ lockHolderKey, failureCountKey }) => {
			const tabId = `${Date.now()}-${Math.random()}`;
			const releaseLockForThisTab = () => {
				if (localStorage.getItem(lockHolderKey) === tabId) {
					localStorage.removeItem(lockHolderKey);
				}
			};
			(window as any).simulateOpfsCleanupLockForThisTab = () => {
				localStorage.setItem(lockHolderKey, tabId);
				localStorage.removeItem(failureCountKey);
			};
			window.addEventListener('beforeunload', releaseLockForThisTab);
			window.addEventListener('pagehide', releaseLockForThisTab);

			const originalRemoveEntry =
				FileSystemDirectoryHandle.prototype.removeEntry;
			FileSystemDirectoryHandle.prototype.removeEntry =
				function removeEntry(name, options) {
					const lockHolder = localStorage.getItem(lockHolderKey);
					if (
						lockHolder &&
						lockHolder !== tabId &&
						name !== 'wp-runtime.json' &&
						name !== 'blueprint'
					) {
						const failureCount = Number(
							localStorage.getItem(failureCountKey) || '0'
						);
						localStorage.setItem(
							failureCountKey,
							String(failureCount + 1)
						);
						return Promise.reject(
							new DOMException(
								`Simulated OPFS cleanup lock for ${name}`,
								'InvalidStateError'
							)
						);
					}
					return originalRemoveEntry.call(this, name, options);
				};
		},
		{
			lockHolderKey: OPFS_CLEANUP_LOCK_HOLDER_KEY,
			failureCountKey: OPFS_CLEANUP_FAILURE_COUNT_KEY,
		}
	);
}

/**
 * Writes the OPFS state left by an interrupted saved Playground reset.
 *
 * `wp-runtime.json` already asks for the new setup, but old WordPress files
 * still sit next to it because the tab closed before cleanup finished.
 */
async function writePendingOpfsResetSite(page: Page, slug: string) {
	await page.evaluate(
		async ({ dirName, siteSlug }) => {
			const root = await navigator.storage.getDirectory();
			try {
				await root.removeEntry('sites', { recursive: true });
			} catch (error) {
				if (error?.name !== 'NotFoundError') {
					throw error;
				}
			}
			const sites = await root.getDirectoryHandle('sites', {
				create: true,
			});
			const siteDirectory = await sites.getDirectoryHandle(dirName, {
				create: true,
			});
			const metadata = {
				slug: siteSlug,
				originalUrlParams: undefined,
				originalBlueprintSource: { type: 'none' },
				originalBlueprint: {
					preferredVersions: { php: '8.4', wp: false },
					landingPage: '/index.php',
					steps: [
						{
							step: 'writeFile',
							path: '/wordpress/index.php',
							data: '<?php echo "cleanup retry ready";',
						},
					],
				},
				name: siteSlug,
				id: siteSlug,
				whenCreated: Date.now(),
				whenLastUsed: Date.now(),
				persistence: 'autosave',
				storage: 'opfs',
				initialOpfsSyncPending: true,
				opfsSiteRemovalPending: true,
				sourceSetupUrlFingerprint: `test-${siteSlug}`,
				runtimeConfiguration: {
					phpVersion: '8.4',
					wpVersion: 'latest',
					intl: false,
					networking: true,
					extraLibraries: [],
					constants: {},
				},
			};
			await writeFile(
				siteDirectory,
				'wp-runtime.json',
				JSON.stringify(metadata, null, 2)
			);
			await writeFile(
				siteDirectory,
				'wp-config.php',
				'<?php /* old config */'
			);
			await writeFile(
				siteDirectory,
				'wp-settings.php',
				'<?php /* old settings */'
			);
			await writeFile(
				siteDirectory,
				'old-reset-sentinel.php',
				'old site'
			);
			const wpContent = await siteDirectory.getDirectoryHandle(
				'wp-content',
				{ create: true }
			);
			const database = await wpContent.getDirectoryHandle('database', {
				create: true,
			});
			await writeFile(database, '.ht.sqlite', 'old sqlite placeholder');

			async function writeFile(
				directory: FileSystemDirectoryHandle,
				name: string,
				contents: string
			) {
				const file = await directory.getFileHandle(name, {
					create: true,
				});
				const writable = await file.createWritable();
				await writable.write(contents);
				await writable.close();
			}
		},
		{ dirName: getDirectoryNameForSlug(slug), siteSlug: slug }
	);
}

/**
 * Writes the OPFS state left when a site's first WordPress file copy stops.
 *
 * The metadata exists, but `initialOpfsSyncPending` still marks the WordPress
 * files as incomplete.
 */
async function writeInterruptedInitialOpfsSite(page: Page, slug: string) {
	await page.evaluate(
		async ({ dirName, siteSlug }) => {
			const root = await navigator.storage.getDirectory();
			try {
				await root.removeEntry('sites', { recursive: true });
			} catch (error) {
				if (error?.name !== 'NotFoundError') {
					throw error;
				}
			}
			const sites = await root.getDirectoryHandle('sites', {
				create: true,
			});
			const siteDirectory = await sites.getDirectoryHandle(dirName, {
				create: true,
			});
			const metadata = {
				slug: siteSlug,
				originalUrlParams: {
					searchParams: {},
					hash: '',
				},
				originalBlueprintSource: { type: 'none' },
				originalBlueprint: {},
				name: siteSlug,
				id: siteSlug,
				whenCreated: Date.now(),
				whenLastUsed: Date.now(),
				persistence: 'autosave',
				storage: 'opfs',
				initialOpfsSyncPending: true,
				runtimeConfiguration: {
					phpVersion: '8.4',
					wpVersion: 'latest',
					intl: false,
					networking: true,
					extraLibraries: [],
					constants: {},
				},
			};
			const metadataFile = await siteDirectory.getFileHandle(
				'wp-runtime.json',
				{ create: true }
			);
			const writable = await metadataFile.createWritable();
			await writable.write(JSON.stringify(metadata, null, 2));
			await writable.close();
		},
		{ dirName: getDirectoryNameForSlug(slug), siteSlug: slug }
	);
}

async function readPendingResetSiteState(page: Page, slug: string) {
	return await page.evaluate(
		async ({ dirName }) => {
			const root = await navigator.storage.getDirectory();
			const sites = await root.getDirectoryHandle('sites');
			const siteDirectory = await sites.getDirectoryHandle(dirName);
			const metadataFile =
				await siteDirectory.getFileHandle('wp-runtime.json');
			const metadata = JSON.parse(
				await (await metadataFile.getFile()).text()
			);
			const hasEntry = async (name: string) => {
				try {
					await siteDirectory.getFileHandle(name);
					return true;
				} catch (error) {
					if (error?.name === 'NotFoundError') {
						return false;
					}
					throw error;
				}
			};
			return {
				metadata,
				hasOldResetSentinel: await hasEntry('old-reset-sentinel.php'),
			};
		},
		{ dirName: getDirectoryNameForSlug(slug) }
	);
}

/** Returns the active Playground name kept in the Dock chrome. */
function getPlaygroundTitle(page: Page) {
	return page.locator('[class*="dock-site-name"]');
}

/** Opens the Dock's Store permanently pane from its save-status control. */
async function openStorePermanentlyPane(page: Page) {
	await page
		.getByRole('navigation', { name: 'Playground tools' })
		.getByRole('button', { name: /^(Unsaved|Autosaved)$/ })
		.click();
	const pane = page.locator('section[aria-label="Store permanently pane"]');
	await expect(pane).toBeVisible({ timeout: 10000 });
	return pane;
}

/** Saves the active site through the Dock's Store permanently pane. */
async function saveSiteViaDockPane(
	page: Page,
	options?: {
		customName?: string;
		storageType?: 'opfs' | 'local-fs';
	}
) {
	const { customName, storageType = 'opfs' } = options || {};

	const pane = await openStorePermanentlyPane(page);

	// If a custom name is provided, update it
	if (customName) {
		const nameInput = pane.getByLabel('Playground name');
		await nameInput.fill('');
		await nameInput.type(customName);
	}

	if (storageType === 'opfs') {
		await pane
			.getByRole('radio', { name: /Save in browser storage/ })
			.check();
	} else {
		await pane
			.getByRole('radio', { name: /Save in a local directory/ })
			.check();
	}

	await pane.getByRole('button', { name: 'Save' }).click();

	// Wait for the pane to close.
	// The save operation syncs to OPFS which can take time, so we use a longer timeout.
	await expect(pane).not.toBeVisible({ timeout: 60000 });
}

async function getActivePlaygroundSite(page: Page) {
	return page.evaluate(() =>
		(window as any).playgroundSites
			.list()
			.find((site: any) => site.isActive)
	);
}

async function getStoredPlaygroundSiteSlugs(page: Page) {
	return page.evaluate(() => {
		const sitesAPI = (window as any).playgroundSites;
		if (!sitesAPI) {
			return null;
		}
		return sitesAPI
			.list()
			.filter((site: any) => site.storage !== 'temporary')
			.map((site: any) => site.slug)
			.sort();
	});
}

async function getInitialOpfsSyncPending(page: Page, siteSlug: string) {
	return page.evaluate(
		async ({ directoryName }) => {
			const root = await navigator.storage.getDirectory();
			const sites = await root.getDirectoryHandle('sites');
			const siteDirectory = await sites.getDirectoryHandle(directoryName);
			const metadataFile =
				await siteDirectory.getFileHandle('wp-runtime.json');
			const metadata = JSON.parse(
				await (await metadataFile.getFile()).text()
			);
			return metadata.initialOpfsSyncPending === true;
		},
		{ directoryName: getDirectoryNameForSlug(siteSlug) }
	);
}

/** Waits until a new OPFS site is safe to reload. */
async function waitForInitialOpfsSync(page: Page, siteSlug: string) {
	await expect
		.poll(() => getInitialOpfsSyncPending(page, siteSlug), {
			timeout: 120000,
		})
		.toBe(false);
}

async function readOpfsWpContentFile(
	page: Page,
	siteSlug: string,
	filename: string
) {
	return page.evaluate(
		async ({ directoryName, filename }) => {
			try {
				const root = await navigator.storage.getDirectory();
				const sites = await root.getDirectoryHandle('sites');
				const site = await sites.getDirectoryHandle(directoryName);
				const wpContent = await site.getDirectoryHandle('wp-content');
				const file = await wpContent.getFileHandle(filename);
				return await (await file.getFile()).text();
			} catch (error) {
				if (error?.name === 'NotFoundError') {
					return undefined;
				}
				throw error;
			}
		},
		{ directoryName: getDirectoryNameForSlug(siteSlug), filename }
	);
}

async function waitForActivePlaygroundSiteSlug(
	page: Page,
	matchesSlug: (slug: string) => boolean
) {
	await expect
		.poll(
			async () => {
				const slug = (await getActivePlaygroundSite(page))?.slug;
				return typeof slug === 'string' &&
					slug.length > 0 &&
					matchesSlug(slug)
					? slug
					: '';
			},
			{ timeout: 120000 }
		)
		.not.toBe('');

	return await getActivePlaygroundSite(page);
}

async function setActivePlaygroundSite(page: Page, siteSlug: string) {
	await page.evaluate(
		(slug) =>
			(window as any).playgroundSites.setActiveSite(slug, {
				updateUrl: false,
			}),
		siteSlug
	);
}

async function openPlaygroundPath(page: Page, path: string) {
	// goTo() resolves after the nested iframe loads, so no additional test delay is needed.
	await page.evaluate(
		(requestedPath) => (window as any).playground.goTo(requestedPath),
		path
	);
}

// OPFS is browser-scoped, so `@storage` routes this suite to the one-worker CI lane.
test.describe('OPFS', { tag: '@storage' }, () => {
	// Default mode retries only the failed test instead of replaying the suite.
	test.describe.configure({ mode: 'default' });

	test('should retry pending OPFS cleanup after another tab releases storage', async ({
		website,
		context,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await simulateOpfsCleanupBlockedByAnotherTab(context);
		const slug = `pending-cleanup-${Date.now()}`;
		await website.page.goto(getTemporaryPlaygroundUrl());
		await website.page.waitForFunction(
			() => !!navigator.storage?.getDirectory
		);
		await writePendingOpfsResetSite(website.page, slug);

		const lockPage = await context.newPage();
		await lockPage.goto(getTemporaryPlaygroundUrl());
		await lockPage.evaluate(() => {
			(window as any).simulateOpfsCleanupLockForThisTab();
		});

		await website.page.goto(
			`./?site-slug=${encodeURIComponent(slug)}&random=${Date.now()}`
		);
		await expect
			.poll(() =>
				website.page.evaluate(
					(failureCountKey) =>
						Number(localStorage.getItem(failureCountKey) || '0'),
					OPFS_CLEANUP_FAILURE_COUNT_KEY
				)
			)
			.toBeGreaterThan(0);

		// This mirrors the user closing another Playground tab that still holds on
		// to the old OPFS files. The next automatic retry should finish cleanup and boot.
		await lockPage.close({ runBeforeUnload: true });
		await expect
			.poll(() =>
				website.page.evaluate(
					(lockHolderKey) => localStorage.getItem(lockHolderKey),
					OPFS_CLEANUP_LOCK_HOLDER_KEY
				)
			)
			.toBeNull();

		await expect(website.wordpress().locator('body')).toContainText(
			'cleanup retry ready',
			{ timeout: 120000 }
		);
		await expect(
			website.page.getByText('Close other Playground tabs, then reload')
		).not.toBeVisible();

		const storedSite = await readPendingResetSiteState(website.page, slug);
		expect(storedSite.metadata.opfsSiteRemovalPending).toBeUndefined();
		expect(storedSite.hasOldResetSentinel).toBe(false);
	});

	test('should start a new Playground after an initial OPFS sync was interrupted', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		const interruptedSiteSlug = `interrupted-initial-sync-${Date.now()}`;
		await website.page.goto(getTemporaryPlaygroundUrl());
		await website.page.waitForFunction(
			() => !!navigator.storage?.getDirectory
		);
		await writeInterruptedInitialOpfsSite(
			website.page,
			interruptedSiteSlug
		);

		await website.page.goto(
			`./?site-slug=${encodeURIComponent(interruptedSiteSlug)}`
		);
		await expect(
			website.page.getByText('Start a new Playground to continue')
		).toBeVisible();

		await website.page
			.getByRole('button', { name: 'Start a new Playground' })
			.click();

		await expect
			.poll(
				async () => (await getActivePlaygroundSite(website.page))?.slug,
				{
					timeout: 15000,
				}
			)
			.not.toBe(interruptedSiteSlug);
		await expect(
			website.page.getByText('Start a new Playground to continue')
		).not.toBeVisible();
		await website.waitForNestedIframes();
	});

	test('should not offer an unfinished initial OPFS sync loaded from storage as a recent autosave', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		const interruptedSiteSlug = `interrupted-autosave-${Date.now()}`;
		await website.page.goto(getTemporaryPlaygroundUrl());
		await website.page.waitForFunction(
			() => !!navigator.storage?.getDirectory
		);
		await writeInterruptedInitialOpfsSite(
			website.page,
			interruptedSiteSlug
		);

		await website.page.goto('./');
		const restoreNudge = website.page.getByLabel(
			'Recent autosaved Playground'
		);
		const autosavedStatus = website.page.getByRole('button', {
			name: 'Autosaved',
		});
		await expect(restoreNudge.or(autosavedStatus)).toBeVisible({
			timeout: 120000,
		});

		expect(await restoreNudge.count()).toBe(0);
		await expect(autosavedStatus).toBeVisible();
		await expect
			.poll(() => getActivePlaygroundSite(website.page))
			.toMatchObject({
				storage: 'opfs',
				persistence: 'autosave',
			});
	});

	test('should persist pooled PHP request writes to an autosaved OPFS site', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(`./?random=${Date.now()}`);
		await website.page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		const site = await getActivePlaygroundSite(website.page);
		await waitForInitialOpfsSync(website.page, site.slug);

		const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const markerName = `pooled-request-${testId}.txt`;
		const markerContents = 'written by a pooled PHP instance';
		const documentRoot = await website.page.evaluate(async () => {
			const playground = (window as any).playgroundSites.getClient();
			return await playground.documentRoot;
		});
		const markerPath = joinPaths(documentRoot, 'wp-content', markerName);
		const primaryOnlyMarkerPath = `/primary-php-${testId}`;

		const result = await website.page.evaluate(
			async ({
				markerContents,
				markerPath,
				primaryOnlyMarkerPath,
				testId,
			}) => {
				const playground = (window as any).playgroundSites.getClient();
				// This random path is outside the proxied filesystems. Writing it through
				// the client creates it only on the primary, so each request can report
				// which pooled PHP instance handled it.
				await playground.writeFile(
					primaryOnlyMarkerPath,
					'only the primary PHP instance can see this file'
				);

				const waitForFile = async (path: string) => {
					const deadline = Date.now() + 10_000;
					while (!(await playground.fileExists(path))) {
						if (Date.now() >= deadline) {
							throw new Error(
								`Timed out waiting for file: ${path}`
							);
						}
						await new Promise((resolve) => setTimeout(resolve, 10));
					}
				};

				// The pool does not expose replica selection. Hold two requests behind
				// file barriers so the first occupies the primary and the second uses a
				// replica, then finish the primary before the replica writes the marker.
				const firstRequestBarrierPath = `/tmp/barrier-first-${testId}`;
				const firstRequest = playground.run({
					code: `<?php
file_put_contents(${JSON.stringify(firstRequestBarrierPath)}, 'ready');
while (file_get_contents(${JSON.stringify(firstRequestBarrierPath)}) !== 'release') {
	usleep(1000);
}
echo file_exists(${JSON.stringify(primaryOnlyMarkerPath)})
	? 'primary'
	: 'secondary';
`,
				});
				await waitForFile(firstRequestBarrierPath);

				const secondRequestBarrierPath = `/tmp/barrier-second-${testId}`;
				const secondRequest = playground.run({
					code: `<?php
file_put_contents(${JSON.stringify(secondRequestBarrierPath)}, 'ready');
while (file_get_contents(${JSON.stringify(secondRequestBarrierPath)}) !== 'release') {
	usleep(1000);
}
file_put_contents(
	${JSON.stringify(markerPath)},
	${JSON.stringify(markerContents)}
);
echo file_exists(${JSON.stringify(primaryOnlyMarkerPath)})
	? 'primary'
	: 'secondary';
`,
				});
				await waitForFile(secondRequestBarrierPath);

				await playground.writeFile(firstRequestBarrierPath, 'release');
				const firstResponse = await firstRequest;
				await playground.writeFile(secondRequestBarrierPath, 'release');
				const secondResponse = await secondRequest;

				return {
					liveMarkerContents:
						await playground.readFileAsText(markerPath),
					firstRequestRole: firstResponse.text,
					secondRequestRole: secondResponse.text,
				};
			},
			{ markerContents, markerPath, primaryOnlyMarkerPath, testId }
		);

		expect(result.firstRequestRole).toBe('primary');
		expect(result.secondRequestRole).toBe('secondary');
		// The write reached the shared live VFS, isolating persistence as the
		// only possible cause if the same bytes are missing from OPFS below.
		expect(result.liveMarkerContents).toBe(markerContents);

		// The primary request has fully ended before the secondary is allowed to
		// write. Thus only the secondary request can trigger this persistence.
		await expect
			.poll(
				() =>
					readOpfsWpContentFile(website.page, site.slug, markerName),
				{ timeout: 3000 }
			)
			.toBe(markerContents);
	});

	test('should switch between sites', async ({ website, browserName }) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());

		await website.ensureSiteManagerIsOpen();

		// Store the temporary site from the Dock.
		const firstSiteName = 'Switching Test Site';
		await saveSiteViaDockPane(website.page, { customName: firstSiteName });

		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			'Unsaved Playground',
			{
				// Saving the site takes a while on CI
				timeout: 90000,
			}
		);
		await expect(getPlaygroundTitle(website.page)).toContainText(
			firstSiteName
		);

		// Start another saved Playground, then switch back to the first one.
		await website.openDockPane('New Playground');
		await website.page
			.getByRole('button', {
				name: 'Vanilla WordPress - New Playground',
				exact: true,
			})
			.click();
		await website.waitForNestedIframes();
		await website.ensureSiteManagerIsOpen();

		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			firstSiteName
		);
		await expect(
			website.page.getByRole('button', { name: 'Autosaved' })
		).toBeVisible({ timeout: 120000 });
		await expect
			.poll(() =>
				website.page.evaluate(() => {
					const activeSite = (window as any).playgroundSites
						.list()
						.find((site: any) => site.isActive);
					return activeSite
						? `${activeSite.storage}:${activeSite.persistence}`
						: null;
				})
			)
			.toBe('opfs:autosave');

		await website.openPlaygroundsPane();
		await website.page
			.locator('[class*="siteRowContent"]')
			.filter({ hasText: firstSiteName })
			.click();
		await website.ensureSiteManagerIsOpen();

		await expect(getPlaygroundTitle(website.page)).toContainText(
			firstSiteName
		);
	});

	test('should preserve PHP constants when saving a temporary site to OPFS', async ({
		website,
		browserName,
		wordpress,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		// Start a site with a specific PHP constant.
		const blueprint: Blueprint = {
			landingPage: '/index.php',
			constants: { E2E_TEST_CONSTANT: 'E2E_TEST_VALUE' },
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/index.php',
					data: '<?php echo E2E_TEST_CONSTANT;',
				},
			],
		};
		await website.goto(
			getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
		);

		await website.ensureSiteManagerIsOpen();

		// Store the temporary site from the Dock.
		await saveSiteViaDockPane(website.page);

		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			'Unsaved Playground',
			{
				// Saving the site takes a while on CI
				timeout: 90000,
			}
		);

		const storedPlaygroundTitleText = await getPlaygroundTitle(
			website.page
		).textContent();
		await expect(storedPlaygroundTitleText).not.toBeNull();
		await expect(storedPlaygroundTitleText).not.toMatch(
			'Unsaved Playground'
		);

		// Create another Playground, then switch back.
		await website.openDockPane('New Playground');
		await website.page
			.getByRole('button', {
				name: 'Vanilla WordPress - New Playground',
				exact: true,
			})
			.click();
		await website.waitForNestedIframes();

		// Open the Playgrounds pane again to switch back to the stored site.
		await website.openPlaygroundsPane();

		// Switch back to the stored site and confirm the PHP constant is still present.
		await website.page
			.locator('[class*="siteRowContent"]')
			.filter({ hasText: storedPlaygroundTitleText! })
			.click();

		await expect(wordpress.locator('body')).toContainText('E2E_TEST_VALUE');
	});

	test('should rename a saved Playground and persist after reload', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.ensureSiteManagerIsOpen();

		// Save the temporary site to OPFS so rename is available
		await saveSiteViaDockPane(website.page);

		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			'Unsaved Playground',
			{
				timeout: 90000,
			}
		);

		await website.ensureSiteManagerIsOpen();

		// Rename from the Site Settings header.
		await website.page
			.getByRole('button', { name: 'Rename Playground' })
			.click();

		const newName = 'My Renamed Playground';
		const nameInput = website.page.getByRole('textbox', {
			name: 'Rename Playground',
		});
		await nameInput.fill(newName);
		await nameInput.press('Enter');

		await expect(getPlaygroundTitle(website.page)).toContainText(newName);

		await expect(nameInput).not.toBeVisible();

		// Reload and verify the name persists
		await website.page.reload();
		await website.ensureSiteManagerIsOpen();
		await expect(getPlaygroundTitle(website.page)).toContainText(newName);

		// Verify the name is also updated in the Playgrounds pane.
		await website.openPlaygroundsPane();
		await expect(
			website.page.locator('[class*="siteRowName"]', { hasText: newName })
		).toBeVisible();
		await website.closePlaygroundsPane();
	});

	test('should wait for a temporary OPFS metadata lock', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		await website.page.evaluate(() =>
			(window as any).playgroundSites.saveInBrowser()
		);
		const site = await getActivePlaygroundSite(website.page);
		const newName = 'Renamed after OPFS lock';

		await website.page.evaluate(
			async ({ dirName, newName, slug }) => {
				const root = await navigator.storage.getDirectory();
				const sites = await root.getDirectoryHandle('sites');
				const siteDirectory = await sites.getDirectoryHandle(dirName);
				const metadataFile =
					await siteDirectory.getFileHandle('wp-runtime.json');
				const writable = await metadataFile.createWritable({
					keepExistingData: true,
				});
				const releaseLock = new Promise<void>((resolve, reject) => {
					setTimeout(async () => {
						try {
							await writable.close();
							resolve();
						} catch (error) {
							reject(error);
						}
					}, 200);
				});

				try {
					await (window as any).playgroundSites.rename(newName, slug);
				} finally {
					await releaseLock;
				}
			},
			{
				dirName: getDirectoryNameForSlug(site.slug),
				newName,
				slug: site.slug,
			}
		);

		await website.page.reload();
		await website.page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		await expect
			.poll(
				async () => (await getActivePlaygroundSite(website.page))?.name
			)
			.toBe(newName);
	});

	test('should preserve metadata changes made in different tabs', async ({
		website,
		context,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.page.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		await website.page.evaluate(() =>
			(window as any).playgroundSites.saveInBrowser()
		);
		const site = await getActivePlaygroundSite(website.page);

		const secondTab = await context.newPage();
		await secondTab.goto(
			new URL(
				`./?site-slug=${encodeURIComponent(site.slug)}`,
				website.page.url()
			).href
		);
		await secondTab.waitForFunction(() =>
			Boolean((window as any).playgroundSites)
		);
		await secondTab.evaluate(() =>
			(window as any).playgroundSites.isReady()
		);

		const newName = 'Renamed in the first tab';
		await website.page.evaluate(
			({ name, slug }) =>
				(window as any).playgroundSites.rename(name, slug),
			{ name: newName, slug: site.slug }
		);
		await website.page.evaluate(() =>
			(window as any).playgroundSites.setPhpVersion('8.2')
		);
		await secondTab.evaluate(() =>
			(window as any).playgroundSites.setNetworking(false)
		);

		const persistedMetadata = await website.page.evaluate(
			async (dirName) => {
				const root = await navigator.storage.getDirectory();
				const sites = await root.getDirectoryHandle('sites');
				const siteDirectory = await sites.getDirectoryHandle(dirName);
				const metadataFile =
					await siteDirectory.getFileHandle('wp-runtime.json');
				return JSON.parse(await (await metadataFile.getFile()).text());
			},
			getDirectoryNameForSlug(site.slug)
		);
		expect(persistedMetadata.name).toBe(newName);
		expect(persistedMetadata.runtimeConfiguration.phpVersion).toBe('8.2');
		expect(persistedMetadata.runtimeConfiguration.networking).toBe(false);
	});

	test('should show the Store permanently pane with the save controls', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.ensureSiteManagerIsOpen();

		const pane = await openStorePermanentlyPane(website.page);

		// Verify the playground name input exists and has default value
		const nameInput = pane.getByLabel('Playground name');
		await expect(nameInput).toBeVisible();
		await expect(nameInput).toHaveValue(/.+/);

		// Verify storage location radio buttons exist
		await expect(pane.getByText('Storage location')).toBeVisible();
		await expect(pane.getByText('Save in browser storage')).toBeVisible();
		await expect(pane.getByText('Save in a local directory')).toBeVisible();

		// Verify action buttons exist
		await expect(pane.getByRole('button', { name: 'Save' })).toBeVisible();
		await expect(
			pane.getByRole('button', { name: 'Cancel' })
		).toBeVisible();

		await pane.getByRole('button', { name: 'Cancel' }).click();
		await expect(pane).not.toBeVisible();
	});

	test('should close the Store permanently pane without saving', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.ensureSiteManagerIsOpen();

		const pane = await openStorePermanentlyPane(website.page);

		// Close without saving using Cancel button
		await pane.getByRole('button', { name: 'Cancel' }).click();
		await expect(pane).not.toBeVisible();

		// Verify the site is still temporary
		await expect(getPlaygroundTitle(website.page)).toContainText(
			'Unsaved Playground'
		);

		await openStorePermanentlyPane(website.page);

		// Close using ESC key
		await website.page.keyboard.press('Escape');
		await expect(pane).not.toBeVisible();

		// Verify the site is still temporary
		await expect(getPlaygroundTitle(website.page)).toContainText(
			'Unsaved Playground'
		);
	});

	test('should have playground name input text selected by default', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.ensureSiteManagerIsOpen();

		const pane = await openStorePermanentlyPane(website.page);

		const nameInput = pane.getByLabel('Playground name');

		// Verify the input is focused
		await expect(nameInput).toBeFocused();

		await expect
			.poll(() =>
				nameInput.evaluate(
					(input: HTMLInputElement) =>
						input.selectionStart === 0 &&
						input.selectionEnd === input.value.length
				)
			)
			.toBe(true);

		// Type to replace the selected text
		await website.page.keyboard.type('New Name');
		await expect(nameInput).toHaveValue('New Name');

		await pane.getByRole('button', { name: 'Cancel' }).click();
	});

	test('should save site with custom name', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.ensureSiteManagerIsOpen();

		const customName = 'My Custom Playground Name';

		// Save with custom name using the helper
		await saveSiteViaDockPane(website.page, { customName });

		// Verify the site was saved with the custom name
		await expect(getPlaygroundTitle(website.page)).toContainText(
			customName,
			{
				timeout: 90000,
			}
		);

		// Verify the name also appears in the Playgrounds pane.
		await website.openPlaygroundsPane();
		await expect(
			website.page.locator('[class*="siteRowName"]', {
				hasText: customName,
			})
		).toBeVisible();
		await website.closePlaygroundsPane();
	});

	test('should not persist the Store permanently pane through page refresh', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.ensureSiteManagerIsOpen();

		const pane = await openStorePermanentlyPane(website.page);

		// Dock pane state is not encoded in the URL.
		expect(website.page.url()).not.toContain('modal=save-site');

		// Reload the page
		await website.page.reload();
		await website.waitForPlaygroundShell();

		await expect(pane).toHaveCount(0);
	});

	test('should display OPFS storage option as selected by default', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.ensureSiteManagerIsOpen();

		const pane = await openStorePermanentlyPane(website.page);

		// Verify OPFS option is selected by default
		const opfsRadio = pane.getByRole('radio', {
			name: /Save in browser storage/,
		});
		await expect(opfsRadio).toBeChecked();

		await pane.getByRole('button', { name: 'Cancel' }).click();
	});

	test('should import ZIP into a fresh temporary site without browser storage', async ({
		website,
		browserName,
		context,
	}) => {
		test.skip(
			browserName !== 'chromium',
			'This test controls OPFS availability in Chromium.'
		);
		await context.addInitScript(() => {
			Object.defineProperty(StorageManager.prototype, 'getDirectory', {
				configurable: true,
				value: undefined,
			});
		});

		await website.goto(getTemporaryPlaygroundUrl());
		const siteBeforeImport = await getActivePlaygroundSite(website.page);
		expect(siteBeforeImport?.storage).toBe('temporary');

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();

		const marker = 'TEMPORARY_ZIP_IMPORT_MARKER';
		const markerPath = 'wp-content/temporary-zip-import-marker.txt';
		const zipBuffer = await createTestWordPressZip(
			marker,
			'wp-content/index.php',
			[new File([marker], markerPath)]
		);
		await website.page
			.locator('input[type="file"][accept*=".zip"]')
			.setInputFiles({
				name: 'temporary-playground.zip',
				mimeType: 'application/zip',
				buffer: zipBuffer,
			});

		await expect(
			website.page
				.getByRole('group', { name: 'Operation succeeded' })
				.filter({ hasText: 'Playground imported' })
		).toBeVisible({ timeout: 120000 });
		await expect(
			website.page.getByRole('alert').filter({
				hasText: 'Playground imported',
			})
		).toHaveCount(0);
		const siteAfterImport = await getActivePlaygroundSite(website.page);
		expect(siteAfterImport).toMatchObject({
			storage: 'temporary',
		});
		expect(siteAfterImport.slug).not.toBe(siteBeforeImport.slug);
		await expect
			.poll(async () => {
				return await website.page.evaluate(async (relativePath) => {
					const playground = (
						window as any
					).playgroundSites.getClient();
					const documentRoot = await playground.documentRoot;
					return await playground.readFileAsText(
						`${documentRoot}/${relativePath}`
					);
				}, markerPath);
			})
			.toBe(marker);
	});

	test('should remove the saved site created for a failed ZIP import', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		const activeSiteBeforeImport = await getActivePlaygroundSite(
			website.page
		);
		const storedSiteSlugsBeforeImport = await getStoredPlaygroundSiteSlugs(
			website.page
		);
		expect(storedSiteSlugsBeforeImport).not.toBeNull();

		const importFailed = await website.page.evaluate(async () => {
			try {
				await (window as any).playgroundSites.createNewSiteFromZip(
					new File(['not a zip archive'], 'invalid-playground.zip', {
						type: 'application/zip',
					})
				);
				return false;
			} catch {
				return true;
			}
		});
		expect(importFailed).toBe(true);

		await expect
			.poll(() => getStoredPlaygroundSiteSlugs(website.page))
			.toEqual(storedSiteSlugsBeforeImport);
		await expect
			.poll(
				async () => (await getActivePlaygroundSite(website.page))?.slug
			)
			.toBe(activeSiteBeforeImport.slug);

		await website.page.reload();
		await website.waitForPlaygroundShell();
		await expect
			.poll(() => getStoredPlaygroundSiteSlugs(website.page))
			.toEqual(storedSiteSlugsBeforeImport);
	});

	test('should import a ZIP dropped on the page', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		const sourceSite = await getActivePlaygroundSite(website.page);
		expect(sourceSite?.slug).toBeTruthy();
		const sourceSiteSlug = sourceSite.slug;

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();

		const marker = 'PAGE_DROP_ZIP_IMPORT_MARKER';
		const markerPath = 'wp-content/page-drop-zip-import-marker.php';
		const zipBuffer = await createTestWordPressZip(marker, markerPath);
		await dropZipFile(website.page, 'page-drop-import.zip', zipBuffer);

		await expect(
			website.page.getByText('Playground imported', { exact: true })
		).toBeVisible({ timeout: 120000 });
		await waitForActivePlaygroundSiteSlug(
			website.page,
			(slug) => slug !== sourceSiteSlug
		);
		await openPlaygroundPath(website.page, `/${markerPath}`);
		await expect(wordpress.locator('body')).toContainText(marker);
	});

	test('should show an inline error for a non-ZIP drop', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();
		await dropZipFile(
			website.page,
			'not-a-playground-export.txt',
			Buffer.from('not a zip archive'),
			false
		);

		await expect(
			website.page.getByRole('alert').filter({
				hasText: 'Choose a WordPress Playground .zip export.',
			})
		).toBeVisible();
	});

	test('should notify when a ZIP import loads before autosave finishes', async ({
		website,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		const sourceSite = await getActivePlaygroundSite(website.page);
		expect(sourceSite?.slug).toBeTruthy();
		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();

		const zipBuffer = await createPluginThemeExportZip();
		const fileInput = website.page.locator(
			'input[type="file"][accept*=".zip"]'
		);
		const pane = website.page.getByRole('dialog', {
			name: 'New Playground pane',
		});
		const importProgress = website.page.getByRole('progressbar', {
			name: 'WordPress import progress',
		});
		const autosaveProgress = website.page.getByRole('progressbar', {
			name: 'Autosave progress',
		});
		const importNotice = website.page
			.getByRole('group', { name: 'Operation succeeded' })
			.filter({ hasText: 'Playground imported' });
		const importProgressStarted = expect(importProgress).toBeVisible({
			timeout: 120000,
		});
		const notifyWhileAutosaving = (async () => {
			await expect(autosaveProgress).toBeVisible({ timeout: 120000 });
			const importedSite = await getActivePlaygroundSite(website.page);
			expect(importedSite).toMatchObject({
				storage: 'opfs',
				persistence: 'autosave',
			});
			await setActivePlaygroundSite(website.page, sourceSite.slug);
			await expect(importNotice).toBeVisible();
			expect(
				await getInitialOpfsSyncPending(website.page, importedSite.slug)
			).toBe(true);
			return importedSite;
		})();
		const importProgressAdvanced = expect
			.poll(
				async () => {
					return (
						Number(
							await importProgress.getAttribute('aria-valuenow')
						) > 0
					);
				},
				{
					intervals: [16],
					timeout: 120000,
				}
			)
			.toBe(true);
		await fileInput.setInputFiles({
			name: 'playground-export-with-plugin-and-theme.zip',
			mimeType: 'application/zip',
			buffer: zipBuffer,
		});
		await expect(pane).not.toBeVisible();
		await importProgressStarted;
		await expect(autosaveProgress).toHaveCount(0);
		await importProgressAdvanced;
		await expect(importProgress).toHaveCount(0, { timeout: 120000 });
		const importedSite = await notifyWhileAutosaving;

		// Reopen the retained import runtime before its background sync finishes.
		// setActiveSite() must not wait for a second client-added event.
		await setActivePlaygroundSite(website.page, importedSite.slug);
		expect((await getActivePlaygroundSite(website.page)).slug).toBe(
			importedSite.slug
		);
		await setActivePlaygroundSite(website.page, sourceSite.slug);

		const newPlaygroundButton = website.page.getByRole('button', {
			name: 'New Playground',
			exact: true,
		});
		await expect(newPlaygroundButton).toBeEnabled();

		// A full page load discards the retained runtime. Let its background sync
		// finish before verifying that the imported files survive a cold boot.
		await waitForInitialOpfsSync(website.page, importedSite.slug);
		await website.goto(
			`./?site-slug=${encodeURIComponent(importedSite.slug)}`
		);

		await expect
			.poll(
				() =>
					website.page.evaluate(async () => {
						const playground = (
							window as any
						).playgroundSites.getClient();
						if (!playground) {
							return { plugin: false, theme: false };
						}
						const documentRoot = await playground.documentRoot;
						return {
							plugin: await playground.fileExists(
								`${documentRoot}/wp-content/plugins/close-race-plugin/close-race-plugin.php`
							),
							theme: await playground.fileExists(
								`${documentRoot}/wp-content/themes/close-race-theme/style.css`
							),
						};
					}),
				{ timeout: 90000 }
			)
			.toEqual({ plugin: true, theme: true });
	});

	test('should import ZIP into a new saved site when a saved site exists', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		// Start with a blueprint that writes a distinctive marker to distinguish the saved site
		const savedSiteMarker = 'SAVED_SITE_CONTENT_MARKER_12345';
		const blueprint: Blueprint = {
			landingPage: '/test-marker.php',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/test-marker.php',
					data: `<?php echo '${savedSiteMarker}';`,
				},
			],
		};
		await website.goto(
			getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
		);

		// Verify the marker is present
		await expect(wordpress.locator('body')).toContainText(savedSiteMarker);

		await website.ensureSiteManagerIsOpen();

		// Save the site with a custom name
		const savedSiteName = 'ZIP Import Test Site';
		await saveSiteViaDockPane(website.page, { customName: savedSiteName });

		// Wait for the site to be saved (title should change from "Temporary Playground")
		await expect(getPlaygroundTitle(website.page)).toContainText(
			savedSiteName,
			{ timeout: 90000 }
		);

		// Open the New pane where ZIP imports start.
		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();

		// Create a test ZIP with imported content marker
		const importedMarker = 'IMPORTED_CONTENT_MARKER_67890';
		const zipBuffer = await createTestWordPressZip(importedMarker);

		// Find the hidden file input and upload the ZIP
		const fileInput = website.page.locator(
			'input[type="file"][accept*=".zip"]'
		);

		// Upload the ZIP file
		await fileInput.setInputFiles({
			name: 'test-import.zip',
			mimeType: 'application/zip',
			buffer: zipBuffer,
		});
		await expect(
			website.page.getByText('Playground imported', { exact: true })
		).toBeVisible({ timeout: 120000 });

		// The import should switch us to a new saved Playground by default.
		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			savedSiteName,
			{ timeout: 30000 }
		);
		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			'Unsaved Playground'
		);

		// Now verify the saved site still has the original content.
		// Open the Playgrounds pane and switch to the saved site.
		await website.openPlaygroundsPane();

		await website.page
			.getByRole('button', { name: `Open ${savedSiteName}`, exact: true })
			.click();
		await website.ensureSiteManagerIsOpen();

		// Wait for the saved site to load - this verifies the saved site wasn't overwritten
		// by the ZIP import (which went to a new saved site instead)
		await expect(getPlaygroundTitle(website.page)).toContainText(
			savedSiteName,
			{ timeout: 30000 }
		);
	});

	test('should create a saved site when importing ZIP while on a saved site with no existing temporary site', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		// First, create and save a site
		const savedSiteMarker = 'SAVED_ONLY_MARKER_AAAAA';
		const blueprint: Blueprint = {
			landingPage: '/saved-only-marker.php',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/saved-only-marker.php',
					data: `<?php echo '${savedSiteMarker}';`,
				},
			],
		};
		await website.goto(
			getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
		);
		await expect(wordpress.locator('body')).toContainText(savedSiteMarker);

		await website.ensureSiteManagerIsOpen();

		// Save the site
		const savedSiteName = 'Direct Slug Test Site';
		await saveSiteViaDockPane(website.page, { customName: savedSiteName });

		await expect(getPlaygroundTitle(website.page)).toContainText(
			savedSiteName,
			{ timeout: 90000 }
		);

		// Get the site slug from the URL
		const urlAfterSave = website.page.url();
		const urlObj = new URL(urlAfterSave);
		const siteSlug = urlObj.searchParams.get('site-slug');
		expect(siteSlug).toBeTruthy();

		// Now reload the page directly with the site-slug parameter.
		// This simulates starting fresh with just the saved site (no temporary site).
		await website.page.goto(`./?site-slug=${siteSlug}`);
		await website.waitForNestedIframes();
		await website.ensureSiteManagerIsOpen();

		// Verify we're on the saved site
		await expect(getPlaygroundTitle(website.page)).toContainText(
			savedSiteName
		);

		// Open the New pane where ZIP imports start.
		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();

		// Create a test ZIP
		const importedMarker = 'FRESH_IMPORT_MARKER_BBBBB';
		const zipBuffer = await createTestWordPressZip(importedMarker);

		// Find the file input
		const fileInput = website.page.locator(
			'input[type="file"][accept*=".zip"]'
		);

		// Upload the ZIP file
		await fileInput.setInputFiles({
			name: 'test-import-direct.zip',
			mimeType: 'application/zip',
			buffer: zipBuffer,
		});
		await expect(
			website.page.getByText('Playground imported', { exact: true })
		).toBeVisible({ timeout: 120000 });

		// The import should trigger creation of a new saved site by default.
		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			savedSiteName,
			{ timeout: 30000 }
		);
		await expect(getPlaygroundTitle(website.page)).not.toContainText(
			'Unsaved Playground'
		);

		// Verify the saved site is still intact by switching to it
		await website.openPlaygroundsPane();

		await website.page
			.getByRole('button', { name: `Open ${savedSiteName}`, exact: true })
			.click();
		await website.ensureSiteManagerIsOpen();

		// Wait for the saved site to load - this verifies the saved site wasn't overwritten
		// by the ZIP import (which went to a new saved site instead)
		await expect(getPlaygroundTitle(website.page)).toContainText(
			savedSiteName,
			{ timeout: 30000 }
		);
	});

	test('should persist an imported ZIP saved site after switching away and back', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		const savedSiteMarker = 'ZIP_IMPORT_PERSISTENCE_SOURCE';
		const blueprint: Blueprint = {
			landingPage: '/saved-site-marker.php',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/saved-site-marker.php',
					data: `<?php echo '${savedSiteMarker}';`,
				},
			],
		};
		await website.goto(
			getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
		);
		await expect(wordpress.locator('body')).toContainText(savedSiteMarker);

		await website.ensureSiteManagerIsOpen();
		const savedSiteName = 'ZIP Import Persistence Source';
		await saveSiteViaDockPane(website.page, { customName: savedSiteName });
		await expect(getPlaygroundTitle(website.page)).toContainText(
			savedSiteName,
			{ timeout: 90000 }
		);
		const savedSite = await getActivePlaygroundSite(website.page);
		expect(savedSite?.slug).toBeTruthy();
		const savedSiteSlug = savedSite.slug;

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();

		const importedMarker = 'ZIP_IMPORT_PERSISTED_MARKER';
		const importedMarkerPath = 'imported-marker.php';
		const zipBuffer = await createTestWordPressZip(
			importedMarker,
			importedMarkerPath
		);

		await website.page
			.locator('input[type="file"][accept*=".zip"]')
			.setInputFiles({
				name: 'test-import-persistence.zip',
				mimeType: 'application/zip',
				buffer: zipBuffer,
			});

		await expect(
			website.page.getByText('Playground imported', { exact: true })
		).toBeVisible({ timeout: 120000 });
		const importedSite = await waitForActivePlaygroundSiteSlug(
			website.page,
			(slug) => slug !== savedSiteSlug
		);
		expect(importedSite?.slug).toBeTruthy();
		const importedSiteSlug = importedSite.slug;
		await waitForInitialOpfsSync(website.page, importedSiteSlug);
		// Discard the import runtime before requesting the marker. The fresh runtime
		// must load the imported file from persisted OPFS state.
		await website.goto(
			`./?site-slug=${encodeURIComponent(importedSiteSlug)}`
		);
		await openPlaygroundPath(website.page, `/${importedMarkerPath}`);
		await expect(wordpress.locator('body')).toContainText(importedMarker);

		await setActivePlaygroundSite(website.page, savedSiteSlug);
		await website.waitForNestedIframes();
		await expect(getPlaygroundTitle(website.page)).toContainText(
			savedSiteName,
			{ timeout: 30000 }
		);

		await setActivePlaygroundSite(website.page, importedSiteSlug);
		await website.waitForNestedIframes();
		await openPlaygroundPath(website.page, `/${importedMarkerPath}`);
		await expect(wordpress.locator('body')).toContainText(importedMarker);

		await website.goto(
			`./?site-slug=${encodeURIComponent(importedSiteSlug)}`
		);
		await openPlaygroundPath(website.page, `/${importedMarkerPath}`);
		await expect(wordpress.locator('body')).toContainText(importedMarker);
	});

	test('should retain files omitted from a legacy ZIP export', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		await website.goto(getTemporaryPlaygroundUrl());
		const sourceSite = await getActivePlaygroundSite(website.page);
		expect(sourceSite?.slug).toBeTruthy();
		const sourceSiteSlug = sourceSite.slug;

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();

		const legacyMarker = 'LEGACY_ZIP_IMPORT_MARKER';
		const legacyMarkerPath =
			'wp-content/plugins/legacy-zip-import-marker.php';
		const zipBuffer = await createTestWordPressZip(
			legacyMarker,
			legacyMarkerPath,
			[
				new File(
					[JSON.stringify({ siteUrl: 'http://playground-domain/' })],
					'playground-export.json'
				),
			]
		);
		let importDialogAccepted = false;
		const acceptImportDialog = async (dialog: {
			accept(): Promise<void>;
		}) => {
			await dialog.accept();
			importDialogAccepted = true;
		};
		website.page.on('dialog', acceptImportDialog);
		await website.page
			.locator('input[type="file"][accept*=".zip"]')
			.setInputFiles({
				name: 'legacy-playground-export.zip',
				mimeType: 'application/zip',
				buffer: zipBuffer,
			});

		await expect
			.poll(
				() =>
					website.page.evaluate(
						async ({ originalSlug, markerPath }) => {
							const sitesAPI = (window as any).playgroundSites;
							if (!sitesAPI) {
								return { marker: false, defaultTheme: false };
							}
							const activeSite = sitesAPI
								.list()
								.find((site: any) => site.isActive);
							const playground = sitesAPI.getClient();
							if (
								!activeSite ||
								activeSite.slug === originalSlug ||
								!playground
							) {
								return { marker: false, defaultTheme: false };
							}
							const documentRoot = await playground.documentRoot;
							return {
								marker: await playground.fileExists(
									`${documentRoot}/${markerPath}`
								),
								defaultTheme: await playground.fileExists(
									`${documentRoot}/wp-content/themes/twentytwentyfive/theme.json`
								),
							};
						},
						{
							originalSlug: sourceSiteSlug,
							markerPath: legacyMarkerPath,
						}
					),
				{ timeout: 120000 }
			)
			.toEqual({ marker: true, defaultTheme: true });
		await expect
			.poll(
				async () =>
					importDialogAccepted ||
					(await website.page
						.getByText('Playground imported', { exact: true })
						.isVisible()),
				{ timeout: 120000 }
			)
			.toBe(true);
		website.page.off('dialog', acceptImportDialog);

		await website.waitForNestedIframes();
		await openPlaygroundPath(website.page, '/');
		await expect(wordpress.locator('body')).toBeVisible();
		await expect(wordpress.locator('body')).not.toContainText(
			'There has been a critical error'
		);
	});

	test('should re-import an exported ZIP without switching sites', async ({
		website,
		context,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		const blueprint: Blueprint = {
			meta: {
				title: 'ZIP Reimport Regression',
				author: 'wordpress',
			},
			steps: [],
		};
		const sourceUrl = getTemporaryPlaygroundUrl(
			`#${JSON.stringify(blueprint)}`
		);
		await website.goto(sourceUrl);
		const sourceSiteSlug = await website.page.evaluate(() =>
			(window as any).playgroundSites.createNewSavedSite(
				undefined,
				undefined,
				{
					persistence: 'autosave',
					updateUrl: false,
				}
			)
		);

		// Occupy the next slug after this tab loaded. Its Redux snapshot will not
		// include this site, but both tabs share OPFS.
		const secondTab = await context.newPage();
		await secondTab.goto(new URL(sourceUrl, website.page.url()).href);
		await secondTab.waitForFunction(() =>
			Boolean((window as any).playgroundSites?.getClient())
		);
		const occupiedSiteSlug = await secondTab.evaluate(
			(slugToKeep) =>
				(window as any).playgroundSites.createNewSavedSite(
					undefined,
					undefined,
					{
						updateUrl: false,
						excludeFromPruning: [slugToKeep],
					}
				),
			sourceSiteSlug
		);
		await secondTab.close();

		expect(occupiedSiteSlug).not.toBe(sourceSiteSlug);
		expect((await getActivePlaygroundSite(website.page))?.slug).toBe(
			sourceSiteSlug
		);

		await website.openDockPane('Export');
		const downloadPromise = website.page.waitForEvent('download');
		await website.page
			.getByRole('dialog', { name: 'Export pane' })
			.getByRole('button', { name: 'Download as .zip' })
			.click();
		const download = await downloadPromise;
		const downloadPath = await download.path();
		expect(downloadPath).toBeTruthy();
		const zipBuffer = await readFile(downloadPath!);

		// Downloading must not change the active site before the ZIP is imported.
		expect((await getActivePlaygroundSite(website.page))?.slug).toBe(
			sourceSiteSlug
		);

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();
		const acceptImportDialog = async (dialog: {
			accept(): Promise<void>;
		}) => {
			await dialog.accept();
		};
		website.page.on('dialog', acceptImportDialog);
		await website.page
			.locator('input[type="file"][accept*=".zip"]')
			.setInputFiles({
				name: 'zip-reimport-regression.zip',
				mimeType: 'application/zip',
				buffer: zipBuffer,
			});

		await expect(
			website.page.getByText('Playground imported', { exact: true })
		).toBeVisible({ timeout: 120000 });
		const importedSite = await waitForActivePlaygroundSiteSlug(
			website.page,
			(slug) => slug !== sourceSiteSlug
		);
		website.page.off('dialog', acceptImportDialog);
		expect(importedSite.slug).not.toBe(occupiedSiteSlug);
	});

	test('should preserve a customized default-theme background through export and import', async ({
		website,
		wordpress,
		browserName,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		const purpleBackground = '#7f54b3';
		const purpleBackgroundRgb = 'rgb(127, 84, 179)';
		// Keep the customization in stock-theme files, which older imports replaced
		// with pristine files from the new runtime.
		const blueprint: Blueprint = {
			landingPage: '/',
			steps: [
				{
					step: 'runPHP',
					code: `<?php
					$functions_path = '/wordpress/wp-content/themes/twentytwentyfive/functions.php';
					$customization = <<<'PHP'
add_action('wp_head', function() {
	echo '<style>
body { background-color: ${purpleBackground} !important; }
</style>';
});
PHP;
					file_put_contents(
						$functions_path,
						"\n$customization\n",
						FILE_APPEND
					);
				`,
				},
				{
					step: 'activateTheme',
					themeFolderName: 'twentytwentyfive',
				},
			],
		};
		await website.goto(
			getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
		);
		await expect(wordpress.locator('body')).toHaveCSS(
			'background-color',
			purpleBackgroundRgb
		);
		const sourceSite = await getActivePlaygroundSite(website.page);
		expect(sourceSite?.slug).toBeTruthy();
		const sourceSiteSlug = sourceSite.slug;

		await website.openDockPane('Export');
		const downloadPromise = website.page.waitForEvent('download');
		await website.page
			.getByRole('dialog', { name: 'Export pane' })
			.getByRole('button', { name: 'Download as .zip' })
			.click();
		const download = await downloadPromise;
		const downloadPath = await download.path();
		expect(downloadPath).toBeTruthy();
		const zipBuffer = await readFile(downloadPath!);

		await website.openDockPane('New Playground');
		await website.page
			.getByRole('tab', { name: 'Import zip', exact: true })
			.click();
		let importDialogAccepted = false;
		const acceptImportDialog = async (dialog: {
			accept(): Promise<void>;
		}) => {
			await dialog.accept();
			importDialogAccepted = true;
		};
		website.page.on('dialog', acceptImportDialog);
		await website.page
			.locator('input[type="file"][accept*=".zip"]')
			.setInputFiles({
				name: 'brewcommerce-purple-export.zip',
				mimeType: 'application/zip',
				buffer: zipBuffer,
			});
		const importedSite = await waitForActivePlaygroundSiteSlug(
			website.page,
			(slug) => slug !== sourceSiteSlug
		);
		expect(importedSite?.slug).toBeTruthy();
		const importedSiteSlug = importedSite.slug;
		await expect
			.poll(() =>
				website.page.evaluate(async (background) => {
					const sitesAPI = (window as any).playgroundSites;
					const playground = sitesAPI?.getClient();
					if (!playground) {
						return false;
					}
					const documentRoot = await playground.documentRoot;
					return (
						await playground.readFileAsText(
							`${documentRoot}/wp-content/themes/twentytwentyfive/functions.php`
						)
					).includes(background);
				}, purpleBackground)
			)
			.toBe(true);
		await expect
			.poll(
				async () =>
					importDialogAccepted ||
					(await website.page
						.getByText('Playground imported', { exact: true })
						.isVisible()),
				{ timeout: 120000 }
			)
			.toBe(true);
		website.page.off('dialog', acceptImportDialog);

		await waitForInitialOpfsSync(website.page, importedSiteSlug);
		// Reboot the imported site so the final assertion reads the customization
		// from persisted OPFS state rather than the import runtime.
		await website.goto(
			`./?site-slug=${encodeURIComponent(importedSiteSlug)}`
		);
		await waitForActivePlaygroundSiteSlug(
			website.page,
			(slug) => slug === importedSiteSlug
		);
		await openPlaygroundPath(website.page, '/');
		await expect(wordpress.locator('body')).toHaveCSS(
			'background-color',
			purpleBackgroundRgb
		);
	});

	// Missing site modal tests in a separate describe block to avoid state pollution.
	test.describe('Missing site modal', () => {
		test('should show modal when loading non-existent site slug', async ({
			website,
			wordpress,
			browserName,
			context,
		}) => {
			test.skip(
				browserName !== 'chromium',
				`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
			);

			// Clear all storage to ensure clean state
			await context.clearCookies();

			// Use a unique temporary slug so the missing-site prompt is expected.
			// Missing saved-site URLs create a new autosaved site by default.
			const uniqueSlug = `missing-modal-test-${Date.now()}`;
			await website.goto(`./?storage=temp&site-slug=${uniqueSlug}`);

			// The modal should appear early, even before WordPress fully loads
			await expect(
				website.page.getByRole('dialog', {
					name: 'This is a dialog window which overlays the main content of the page. It offers the user a choice between using an Unsaved Playground and a persistent Playground that is saved to browser storage.',
				})
			).toBeVisible({ timeout: 30000 });
		});

		test('should dismiss modal when clicking dismiss button', async ({
			website,
			wordpress,
			browserName,
			context,
		}) => {
			test.skip(
				browserName !== 'chromium',
				`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
			);

			// Clear storage
			await context.clearCookies();

			const uniqueSlug = `dismiss-modal-test-${Date.now()}`;
			await website.goto(`./?storage=temp&site-slug=${uniqueSlug}`);

			// Wait for modal
			const dialog = website.page.getByRole('dialog', {
				name: 'This is a dialog window which overlays the main content of the page. It offers the user a choice between using an Unsaved Playground and a persistent Playground that is saved to browser storage.',
			});
			await expect(dialog).toBeVisible({ timeout: 30000 });

			// Click dismiss button
			await dialog
				.getByRole('button', {
					name: 'Keep using an Unsaved Playground',
				})
				.click();

			// Modal should close
			await expect(dialog).not.toBeVisible();
		});
	});
});
