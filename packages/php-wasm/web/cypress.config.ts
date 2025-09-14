import path from 'path';
import viteTsConfigPathsModule from 'vite-tsconfig-paths';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig as defineCypressConfig } from 'cypress';
import vitePreprocessor from 'cypress-vite';
import { defineConfig as defineViteConfig } from 'vite';

export default defineCypressConfig({
	e2e: {
		...nxE2EPreset(import.meta.dirname, { cypressDir: 'src/test' }),
		supportFile: false,
		screenshotOnRunFailure: false,
		setupNodeEvents(on) {
			on(
				'file:preprocessor',
				vitePreprocessor(viteConfig({ command: 'serve', mode: 'dev' }))
			);
		},
	},
});

const viteConfig = defineViteConfig(() => ({
	root: path.resolve(import.meta.dirname, 'src'),
	plugins: [
		viteTsConfigPathsModule({ root: '../../../' }),
		{
			name: 'ignore-asset-imports',
			load(id: string) {
				if (
					id?.endsWith('.wasm') ||
					id?.endsWith('.so') ||
					id?.endsWith('.dat')
				) {
					const url = id.split('/public')[1];
					return {
						code: `export default "${url}";`,
						map: null,
					};
				}

				return null;
			},
		},
	],
}));
