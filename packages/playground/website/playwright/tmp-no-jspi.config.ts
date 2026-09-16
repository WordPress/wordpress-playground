import { defineConfig, devices } from '@playwright/test';
import { playwrightConfig } from './playwright.config';

export default defineConfig({
	...playwrightConfig,
	projects: [
		{
			name: 'chromium-no-jspi',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
