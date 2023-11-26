import { defineConfig } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL =
	process.env['BASE_URL'] || 'http://localhost:5400/website-server/';

const preset = nxE2EPreset(new URL(import.meta.url).pathname, {
	testDir: './e2e',
});
preset.projects = [preset.projects![0]];
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	...preset,
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		baseURL,
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
		browserName: 'chromium',
	},
	// Playground boot may be slow
	timeout: 10000,
	/* Run your local dev server before starting the tests */ // webServer: {
	//   command: 'npm run start',
	//   url: 'http://127.0.0.1:3000',
	//   reuseExistingServer: !process.env.CI,
	//   cwd: workspaceRoot,
	// },
});
