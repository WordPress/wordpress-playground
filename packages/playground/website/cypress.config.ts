import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';
import { fileURLToPath } from 'url';
import path from 'path';

export default defineConfig({
	e2e: nxE2EPreset(path.dirname(fileURLToPath(import.meta.url)), {
		cypressDir: 'cypress',
	}),
	// Playground may be slow on GitHub CI
	defaultCommandTimeout: 60000 * 2,
});
