import { defineConfig } from '@playwright/test';
import playwrightConfig from './playwright.config';

/*
 * OPFS is browser-scoped, so storage tests must not overlap in one browser.
 * The dedicated CI lane uses one worker and Playwright's default mode, which
 * retries only a failed test instead of replaying an entire serial group.
 *
 * Every storage-sensitive test carries the `@storage` tag, so the CI routing
 * does not need to know which files contain storage tests.
 */
const storageTests = /@storage/;
const testGroupOptions = getTestGroupOptions(process.env.PLAYWRIGHT_TEST_GROUP);

function getTestGroupOptions(testGroup: string | undefined) {
	switch (testGroup) {
		case 'storage':
			// Storage tests share browser-scoped OPFS, so one worker prevents
			// them from changing the same storage concurrently.
			return { grep: storageTests, workers: 1 };
		case 'regular':
			return { grepInvert: storageTests };
		default:
			throw new Error(
				`Unsupported PLAYWRIGHT_TEST_GROUP: ${JSON.stringify(testGroup)}. ` +
					'Expected "regular" or "storage".'
			);
	}
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	...playwrightConfig,
	...testGroupOptions,
	use: {
		...playwrightConfig.use,
		baseURL: 'http://127.0.0.1/',
	},
	webServer: {
		command: 'npx nx run playground-website:preview:ci-with-proxy',
		url: 'http://127.0.0.1/',
		reuseExistingServer: false,
		env: {
			CORS_PROXY_URL: 'http://127.0.0.1:5263/cors-proxy.php?',
			DEBUG: 'pw:webserver',
		},
	},
});
