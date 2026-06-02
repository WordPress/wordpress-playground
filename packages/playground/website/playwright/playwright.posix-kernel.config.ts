import type { PlaywrightTestConfig } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

const baseURL =
	process.env.PLAYWRIGHT_TEST_BASE_URL ||
	'http://127.0.0.1:5400/website-server/';

export const playwrightConfig: PlaywrightTestConfig = {
	testDir: './e2e/posix-kernel',
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
