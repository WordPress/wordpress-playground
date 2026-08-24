import { test as classicTest } from '../../../playground-fixtures';
import {
	PREINSTALLED_DB_ENV,
	PREINSTALLED_DB_GLOBAL,
	PREINSTALLED_VFS_ENV,
	PREINSTALLED_VFS_GLOBAL,
} from './preinstalled-db';

/**
 * The classic fixtures plus a `page` override that delivers the
 * "boot-once" snapshot URLs to the app via `window` globals (read by
 * `getRemoteUrl`), not query params: a query param on the top page trips
 * the dev server's catch-all proxy → 404. The env vars are set by
 * `playwright.posix-kernel.config.ts`; the VFS image is the fast path,
 * the DB the fallback.
 */
export const test = classicTest.extend({
	page: async ({ page }, use) => {
		const globals: Array<readonly [string, string]> = [];
		const dbUrl = process.env[PREINSTALLED_DB_ENV];
		if (dbUrl) {
			globals.push([PREINSTALLED_DB_GLOBAL, dbUrl] as const);
		}
		const vfsUrl = process.env[PREINSTALLED_VFS_ENV];
		if (vfsUrl) {
			globals.push([PREINSTALLED_VFS_GLOBAL, vfsUrl] as const);
		}
		if (globals.length > 0) {
			await page.addInitScript((entries) => {
				for (const [globalName, url] of entries) {
					(window as any)[globalName] = url;
				}
			}, globals);
		}
		await use(page);
	},
});

export { expect, Page } from '@playwright/test';
