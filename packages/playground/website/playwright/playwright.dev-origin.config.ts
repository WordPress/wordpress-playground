/**
 * Check the Vite source-module path once, after the full built-preview suite.
 * Production's extracted helper bundle can pass while its dev source import
 * fails, so a built preview alone cannot cover this server configuration.
 */
import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { playwrightConfig } from './playwright.config';

export default defineConfig({
	...playwrightConfig,
	testDir: './dev-origin',
	fullyParallel: false,
	workers: 1,
	outputDir: '../../../../dist/wordpress-frame-dev-e2e',
	projects: playwrightConfig.projects
		?.filter((project) => project.name === 'chromium')
		.map((project) => ({
			...project,
			use: { ...project.use, channel: 'chromium' },
		})),
	webServer: {
		command: 'npm run dev',
		// npm and Nx must see the repository root, not this config's directory.
		cwd: resolve(__dirname, '../../../..'),
		url: 'http://127.0.0.1:5400/website-server/',
		reuseExistingServer: false,
		timeout: 180000,
	},
});
