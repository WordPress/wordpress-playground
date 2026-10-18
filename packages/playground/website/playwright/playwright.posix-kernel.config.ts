import type { PlaywrightTestConfig } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';
import {
	PREINSTALLED_DB_ENV,
	PREINSTALLED_DB_URL_PATH,
	PREINSTALLED_VFS_ENV,
	PREINSTALLED_VFS_URL_PATH,
} from './e2e/posix-kernel/fixtures/preinstalled-db';

const baseURL =
	process.env.PLAYWRIGHT_TEST_BASE_URL ||
	'http://127.0.0.1:5400/website-server/';

// Absolute URLs the dev server serves the "boot-once" snapshots at, passed
// to the fixtures (which run in every worker process) via these env vars.
// `globalSetup` writes the files these URLs resolve to. The VFS image is the
// fast path; the DB is the fallback when the image is unavailable.
process.env[PREINSTALLED_DB_ENV] = new URL(
	PREINSTALLED_DB_URL_PATH,
	baseURL
).toString();
process.env[PREINSTALLED_VFS_ENV] = new URL(
	PREINSTALLED_VFS_URL_PATH,
	baseURL
).toString();

export const playwrightConfig: PlaywrightTestConfig = {
	testDir: './e2e/posix-kernel',
	// Boot once, install WordPress, capture the SQLite DB and the VFS
	// image, and serve them so every test boots pre-installed instead of
	// re-running the installer.
	globalSetup: './e2e/posix-kernel/fixtures/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 3,
	// Each kernel boot is CPU-heavy (php-fpm's wasm plus side modules).
	// Concurrent boots starve each other on the 2-core CI runners and
	// push a boot past the timeout, so CI uses 1 worker. Local machines
	// have the cores to spare, so they use 3.
	workers: process.env.CI ? 1 : 3,
	reporter: [['html'], ['list', { printSteps: true }]],
	use: {
		baseURL,
		trace: 'on-first-retry',
		actionTimeout: 120000,
		navigationTimeout: 120000,
	},

	timeout: 480000,
	// 240s, not the Playwright default 60s. `website.goto()` →
	// `waitForNestedIframes()` asserts the WP iframe body is non-empty,
	// and in kernel mode that gates on a full cold boot: Vite dep
	// pre-bundling + the kernel bringing up php-fpm/nginx,
	// plus any blueprint PHP spawns (e.g. setSiteLanguage). The budget
	// covers that chain on the 2-core CI runners while staying well below
	// the 480s per-test timeout, so a stuck boot still fails the assertion
	// rather than hanging the whole test.
	expect: { timeout: 240000 },

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
		},
	],

	webServer: {
		command: 'npx nx run playground-website:dev-experimental-posix-kernel',
		url: 'http://127.0.0.1:5400/website-server/',
		reuseExistingServer: !process.env.CI,
	},
};

export default defineConfig(playwrightConfig);
