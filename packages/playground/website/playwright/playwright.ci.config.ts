import { defineConfig } from '@playwright/test';
import playwrightConfig from './playwright.config';

/*
 * OPFS is browser-scoped, so storage tests must not overlap in one browser.
 * The dedicated CI lane uses one worker and Playwright's default mode, which
 * retries only a failed test instead of replaying an entire serial group.
 *
 * `opfs.spec.ts` is entirely storage-sensitive. The tag selects the storage
 * describe nested inside the otherwise parallel `website-ui.spec.ts` file.
 */
const storageTests = /(?:opfs\.spec\.ts|@storage)/;
const testGroup = process.env.PLAYWRIGHT_TEST_GROUP;
const testGroupOptions =
	testGroup === 'storage'
		? { grep: storageTests, workers: 1 }
		: testGroup === 'regular'
			? { grepInvert: storageTests }
			: {};

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
