import { defineConfig } from '@playwright/test';

const port = process.env.DOCS_E2E_PORT ?? '4173';
const host = process.env.DOCS_E2E_HOST ?? '127.0.0.1';
const baseUrl = process.env.DOCS_E2E_BASE_URL ?? `http://${host}:${port}`;

export default defineConfig({
	testDir: './tests',
	timeout: 60_000,
	expect: {
		timeout: 10_000,
	},
	use: {
		baseURL: baseUrl,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	webServer: {
		command: `npx http-server dist/docs/build -p ${port} -c-1`,
		url: `${baseUrl}/wordpress-playground/`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium' },
		},
	],
});
