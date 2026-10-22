/**
 * Run the website and origin-boundary tests against the built two-host preview.
 * Reuse the normal browser projects and tagged CI groups instead of maintaining
 * a smaller, separate suite that could miss regressions in existing integrations.
 * Without an explicit group, local runs use one worker because this suite creates
 * saved sites and measures shared downloads. The environment flag also sends the
 * deployment tests through the two-host release-switching server.
 */
import { defineConfig } from '@playwright/test';
import { appOrigin } from '../bin/wordpress-frame/origins.mjs';
import { playwrightConfig } from './playwright.config';
import { getTestGroupOptions } from './playwright-test-groups';

// Also route deployment.spec.ts through the split-origin server, not localhost's old path.
process.env.PLAYWRIGHT_WORDPRESS_FRAME = '1';
const testGroupOptions = process.env.PLAYWRIGHT_TEST_GROUP
	? getTestGroupOptions(process.env.PLAYWRIGHT_TEST_GROUP)
	: { fullyParallel: false, workers: 1 };

export default defineConfig({
	...playwrightConfig,
	testDir: '.',
	testMatch: ['wordpress-frame/**/*.spec.ts', 'e2e/**/*.spec.ts'],
	...testGroupOptions,
	outputDir: '../../../../dist/wordpress-frame-e2e',
	use: {
		...playwrightConfig.use,
		baseURL: appOrigin + '/',
		screenshot: 'only-on-failure',
	},
	projects: playwrightConfig.projects?.map((project) => ({
		...project,
		use: {
			...project.use,
			...(project.name === 'chromium' ? { channel: 'chromium' } : {}),
		},
	})),
	webServer: {
		command: process.env.CI
			? 'node ../bin/run-ci-preview-with-cors-proxy.cjs'
			: 'node ../bin/wordpress-frame/serve.mjs',
		url: appOrigin,
		reuseExistingServer: false,
		env: { CORS_PROXY_URL: 'http://127.0.0.1:5263/cors-proxy.php?' },
	},
});
