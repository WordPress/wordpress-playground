import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
	e2e: nxE2EPreset(__dirname, {
		cypressDir: 'cypress',
	}),
	// Playground may be slow on GitHub CI
	defaultCommandTimeout: 60000 * 2,
	// Each query API test boots a full PHP-Wasm runtime. Reclaim Chromium's
	// heap between tests so repeated boots do not exhaust CI runners.
	experimentalMemoryManagement: true,
});
