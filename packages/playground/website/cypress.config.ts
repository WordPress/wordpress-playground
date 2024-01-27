import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

// @ts-ignore
const currentPath = new URL(import.meta.url).pathname;
export default defineConfig({
	e2e: nxE2EPreset(currentPath, {
		cypressDir: 'cypress',
	}),
	// Playground may be slow to start up
	defaultCommandTimeout: 90000,
});
