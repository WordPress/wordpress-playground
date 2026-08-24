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
	// Boot once, install WordPress, capture the SQLite DB, and serve it so
	// every test boots pre-installed instead of re-running the installer.
	globalSetup: './e2e/posix-kernel/fixtures/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 3,
	// 1, not 3. Kernel-mode boot is heavy: each boot builds a fresh VFS
	// image and the kernel instantiates php-fpm's 18 MB wasm (+ zip/curl/
	// phar side modules) on a worker thread. With 3 kernels booting at
	// once on a CI runner they starve each other's CPU — the [diag]
	// capture caught php-fpm instantiation stalling ~32s (bridge poll
	// froze req#149→#150) and php-fpm then returning persistent 502s,
	// pushing a single boot from ~60s to 115s–>180s and making it
	// UNBOUNDED run-to-run (one run finished in 115s, the next blew past
	// the 180s expect budget). globalSetup's single uncontended boot has
	// succeeded on every run — that's the baseline this restores.
	// Serializing trades some wall-clock for a boot that reliably fits
	// the timeout. Revisit if per-boot cost (VFS build / dep pre-bundle)
	// is brought down enough to reintroduce parallelism.
	//
	// CI keeps 1 worker (2-core runners starve under concurrent kernel
	// boots — see above). Local dev machines have the cores to spare, so
	// default to 3 there to cut the serialized wall-clock.
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
	// pre-bundling + VFS build + the kernel bringing up php-fpm/nginx.
	// The ABI-42 kandelo program builds embed the wpk_fork linked-frames
	// machinery (dinit code section +73%, php-fpm +27% at identical
	// upstream versions), which roughly doubles kernel bring-up in the
	// browser: plain boots went ~35-45s → ~80-100s on the 2-core CI
	// runners, and boots that also run blueprint PHP spawns (e.g.
	// setSiteLanguage) need ~145s. 240s restores headroom over the worst
	// observed chain while staying well below the 480s per-test timeout,
	// so a stuck boot still fails the assertion (and dumps [diag])
	// rather than hanging the whole test. Revisit both budgets if
	// kandelo reduces the linked-frames cost.
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
