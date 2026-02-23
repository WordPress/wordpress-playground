import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Must be 1: the MCP server supports only one browser connection at a time.
	workers: 1,
	reporter: [['list', { printSteps: true }]],
	use: {
		baseURL: 'http://127.0.0.1:5400/website-server/',
		trace: 'on-first-retry',
		actionTimeout: 120_000,
		navigationTimeout: 120_000,
	},
	timeout: 300_000,
	expect: { timeout: 60_000 },
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
		command: 'npx nx run playground-website:dev',
		url: 'http://127.0.0.1:5400/website-server/',
		reuseExistingServer: !process.env.CI,
	},
});
