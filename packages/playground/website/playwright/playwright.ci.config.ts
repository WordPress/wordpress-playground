import { defineConfig } from '@playwright/test';
import playwrightConfig from './playwright.config';

import { getTestGroupOptions } from './playwright-test-groups';

const testGroupOptions = getTestGroupOptions(process.env.PLAYWRIGHT_TEST_GROUP);

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
