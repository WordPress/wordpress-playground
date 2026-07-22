import type { PlaywrightTestConfig } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

const baseURL =
	process.env.PLAYWRIGHT_TEST_BASE_URL ||
	'http://127.0.0.1:5400/website-server/';
// Reusing port 5400 by default can attach tests to a stale dev server from
// another branch/worktree. Make that opt-in for local debugging.
const reuseExistingServer =
	process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1';
const webkitUse = { ...devices['Desktop Safari'] };
// The catch-all project below keeps new specs covered. Add them here as they
// are created so each one gets its own local WebKit process too.
const macosWebkitIsolatedSpecs = [
	'blueprints.spec.ts',
	'client-side-media.spec.ts',
	'client.spec.ts',
	'deployment.spec.ts',
	'document-isolation-policy.spec.ts',
	'error-handling.spec.ts',
	'github-oauth.spec.ts',
	'isomorphic-git-bundle.spec.ts',
	'opfs.spec.ts',
	'php-code-snippet.spec.ts',
	'query-api.spec.ts',
	'shutdown-loopback-prefetch.spec.ts',
	'sites-api.spec.ts',
	'standalone-pr-previewers.spec.ts',
	'website-ui.spec.ts',
] as const;
const webkitProjects =
	process.platform === 'darwin' && !process.env.CI
		? [
				...macosWebkitIsolatedSpecs.map((testFile) => ({
					name: 'webkit',
					testMatch: `**/${testFile}`,
					use: webkitUse,
				})),
				{
					name: 'webkit',
					testIgnore: macosWebkitIsolatedSpecs.map(
						(testFile) => `**/${testFile}`
					),
					use: webkitUse,
				},
			]
		: [{ name: 'webkit', use: webkitUse }];

export const playwrightConfig: PlaywrightTestConfig = {
	testDir: './e2e',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	// Two independent samples expose intermittent failures without allowing a retry to hide one.
	repeatEach: 2,
	retries: 0,
	// Concurrent dev-mode PHP-WASM boots can stall one another before their
	// remote workers start. CI uses a built preview server and keeps 3 workers.
	workers: process.env.CI ? 3 : 1,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [['html'], ['list', { printSteps: true }]],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL,
		// With retries disabled, on-first-retry records nothing. Capture every run,
		// but discard successful traces so only actionable artifacts are retained.
		trace: 'retain-on-failure',
		actionTimeout: 120000,
		navigationTimeout: 120000,
	},

	timeout: 300000,
	expect: { timeout: 60000 },

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: ['--js-flags=--enable-experimental-webassembly-jspi'],
				},
				// The macOS headless shell crashes after repeated PHP-WASM
				// contexts. The bundled Chromium channel uses the stable full
				// browser in new headless mode. Keep CI's existing browser choice.
				...(process.platform === 'darwin' && !process.env.CI
					? { channel: 'chromium' }
					: {}),
			},
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},

		// macOS WebKit can terminate its Networking process after repeated
		// PHP-WASM contexts, poisoning later navigations. Per-spec project
		// boundaries give each local file a fresh browser. All partitions keep
		// the same public name, so --project=webkit remains comprehensive.
		...webkitProjects,

		/* Test against mobile viewports. */
		// {
		//   name: 'Mobile Chrome',
		//   use: { ...devices['Pixel 5'] },
		// },
		// {
		// 	name: 'Mobile Safari',
		// 	use: { ...devices['iPhone 12'] },
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		// The website dev server proxies remote.html and website-extras through
		// fixed local ports. If those ports belong to another worktree, tests
		// load mixed code and fail as empty iframes or browser crashes.
		command:
			'node check-local-dev-server-ports.cjs && ' +
			'npx nx run playground-website:dev:playwright',
		url: 'http://127.0.0.1:5400/website-server/',
		reuseExistingServer,
	},
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig(playwrightConfig);
