import {
	defineConfig,
	devices,
	type PlaywrightTestConfig,
} from '@playwright/test';

const baseURL =
	process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:5174/';

export const playwrightConfig: PlaywrightTestConfig = {
	testDir: './tests',
	/* Run tests in files in parallel */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	retries: 3,
	workers: 3,

	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [['html'], ['list', { printSteps: true }]],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL,
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
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
			},
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command:
			'npx nx run playground-components:dev -- --host 127.0.0.1 --port 5174',
		url: 'http://127.0.0.1:5174/',
		reuseExistingServer: !process.env.CI,
	},
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig(playwrightConfig);
