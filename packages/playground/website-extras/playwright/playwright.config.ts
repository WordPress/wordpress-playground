import type { PlaywrightTestConfig } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

const baseURL =
	process.env.PLAYWRIGHT_TEST_BASE_URL ||
	'http://127.0.0.1:6400/website-extras/';

export const playwrightConfig: PlaywrightTestConfig = {
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 3,
	workers: 3,
	reporter: [['html'], ['list', { printSteps: true }]],
	use: {
		baseURL,
		trace: 'on-first-retry',
		actionTimeout: 120000,
		navigationTimeout: 120000,
	},

	timeout: 300000,
	expect: { timeout: 60000 },

	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: ['--js-flags=--enable-experimental-webassembly-jspi'],
				},
			},
		},
	],

	webServer: {
		command: 'npx nx run playground-website-extras:dev',
		url: 'http://127.0.0.1:6400/website-extras/',
		reuseExistingServer: !process.env.CI,
	},
};

export default defineConfig(playwrightConfig);
