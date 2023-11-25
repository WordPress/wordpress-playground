import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
	e2e: nxE2EPreset(new URL(import.meta.url).pathname, {
		cypressDir: 'cypress',
	}),
});
