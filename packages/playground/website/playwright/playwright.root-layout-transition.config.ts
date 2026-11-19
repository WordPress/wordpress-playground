/**
 * Opt-in: run the root-only layout client transition test.
 *
 * It needs a real build from before release directories, which takes 10–15 minutes to
 * make once, so normal CI and the other configs do not include it. Run it with
 * `npx nx run playground-website:e2e:root-layout-transition`. Each test starts its own
 * server for the web root it installs, so there is no shared webServer.
 * Set PLAYWRIGHT_FIREFOX_CHANNEL=moz-firefox where Playwright's Firefox cannot launch.
 */
import { defineConfig } from '@playwright/test';
import { playwrightConfig } from './playwright.config';

export default defineConfig({
	...playwrightConfig,
	testDir: './root-layout-transition',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 600000,
	outputDir: '../../../../dist/root-layout-transition-e2e',
	projects: playwrightConfig.projects?.map((project) =>
		project.name === 'firefox' && process.env.PLAYWRIGHT_FIREFOX_CHANNEL
			? {
					...project,
					use: {
						...project.use,
						channel: process.env.PLAYWRIGHT_FIREFOX_CHANNEL,
					},
				}
			: project
	),
	webServer: undefined,
});
