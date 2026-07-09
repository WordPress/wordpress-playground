import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	outputDir: './src/test/test-results',
	testDir: './src/test',
	testMatch: ['php-dynamic-loading.spec.ts', 'php-networking.spec.ts'],
	fullyParallel: false,
	forbidOnly: !!process.env['CI'],
	workers: 1,

	// Comment this line for more debugging informations
	reporter: [['./src/test/playwright/reporter.ts']],

	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				ignoreHTTPSErrors: true,
			},
		},
	],

	webServer: {
		command: 'npx nx run php-wasm-web:dev',
		env: {
			...process.env,
			JSPI: 'true',
		},
		port: 5173,
		reuseExistingServer: !process.env['CI'],
	},
});
