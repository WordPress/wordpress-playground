/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	outputDir: './src/test/test-results/rpc',
	testDir: './src/test',
	testMatch: ['rpc-browser-lifecycle.spec.ts'],
	fullyParallel: false,
	forbidOnly: !!process.env['CI'],
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:5173',
		ignoreHTTPSErrors: true,
	},
	projects: [
		{
			name: 'chromium',
			use: devices['Desktop Chrome'],
		},
		{
			name: 'firefox',
			use: devices['Desktop Firefox'],
		},
		{
			name: 'webkit',
			use: devices['Desktop Safari'],
		},
	],
	webServer: {
		command: 'npm exec -- nx run php-wasm-web:dev',
		env: {
			...process.env,
			JSPI: 'true',
		},
		port: 5173,
		reuseExistingServer: !process.env['CI'],
	},
});
