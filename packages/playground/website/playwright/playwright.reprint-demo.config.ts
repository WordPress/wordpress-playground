import { defineConfig } from '@playwright/test';
import frameConfig from './playwright.wordpress-frame.config';

const preview = process.env.PLAYWRIGHT_REPRINT_DEMO_PREVIEW === '1';

// Keep the live demo out of the PR suite: an outage there should not block unrelated changes.
export default defineConfig({
	...frameConfig,
	testMatch: 'reprint-demo.spec.ts',
	grep: undefined,
	grepInvert: undefined,
	projects: frameConfig.projects?.filter(
		(project) => project.name === 'chromium'
	),
	retries: 1,
	use: {
		...frameConfig.use,
		baseURL: preview
			? frameConfig.use?.baseURL
			: 'https://playground.wordpress.net/',
	},
	webServer: preview ? frameConfig.webServer : undefined,
});
