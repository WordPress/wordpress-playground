import { defineConfig } from '@playwright/test';
import { playwrightConfig } from './playwright.config';

// Run the existing assertions against a site origin, not the launcher document.
// Keep this separate from CI's normal build and the other local server on 5400.
export default defineConfig({
	...playwrightConfig,
	fullyParallel: false,
	workers: 1,
	retries: 0,
	outputDir: '../../../../dist/origin-isolation-e2e/artifacts',
	reporter: [
		['list'],
		['json', { outputFile: 'dist/origin-isolation-e2e/results.json' }],
	],
	use: {
		...playwrightConfig.use,
		baseURL: 'http://site-e2e.playground.localhost:9400/',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: playwrightConfig.projects?.map((project) => ({
		...project,
		use: {
			...project.use,
			...(project.name === 'chromium' &&
			process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
				? {
						launchOptions: {
							...project.use?.launchOptions,
							executablePath:
								process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
						},
					}
				: {}),
		},
	})),
	webServer: {
		command: 'node ../bin/origin-isolation/serve.mjs',
		port: 9400,
		reuseExistingServer: false,
	},
});
