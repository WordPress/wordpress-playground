import type { PlaywrightTestConfig } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

const baseURL =
	process.env.PLAYWRIGHT_TEST_BASE_URL ||
	'http://127.0.0.1:5401/website-server/';

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

	// Firefox and WebKit can't run personal-wp via the Vite dev server:
	// the WASM PHP runtime requires SharedArrayBuffer, which needs
	// cross-origin isolation headers (COEP/COOP). These are provided by
	// the service worker after it claims the page, but on first load the
	// service worker isn't active yet and the runtime fails to start.
	// The core playground-website E2E tests cover Firefox/WebKit via a
	// built app served with proper headers.
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
		command: 'npx nx run playground-personal-wp:dev',
		url: 'http://127.0.0.1:5401/website-server/',
		reuseExistingServer: !process.env.CI,
	},
};

export default defineConfig(playwrightConfig);
