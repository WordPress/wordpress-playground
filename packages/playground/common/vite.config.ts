/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';
import { getProductionBuildVersion } from './src/build-version';

const path = (filename: string) => new URL(filename, import.meta.url).pathname;
export default defineConfig({
	assetsInclude: ['**/*.wasm', '**/*.dat', '*.zip'],
	cacheDir: '../../../node_modules/.vite/playground-common',
	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
		dts({
			entryRoot: 'src',
			tsconfigPath: path('tsconfig.lib.json'),
			pathsToAliases: false,
		}),

		...viteGlobalExtensions,

		(() => {
			let insertedBuildVersion = false;

			return {
				name: 'use-git-based-build-version',
				async transform(code: string, id: string) {
					if (id !== path('src/build-version.ts')) {
						return code;
					}

					const buildVersion: string =
						await getProductionBuildVersion();
					const updatedCode = code.replace(
						'const buildVersion = getDevelopmentBuildVersion();',
						`const buildVersion = '${buildVersion}';`
					);
					if (updatedCode === code) {
						// eslint-disable-next-line no-console
						console.warn(
							'Failed to replace buildVersion in build-version.ts.'
						);
						return code;
					}

					insertedBuildVersion = true;
					return updatedCode;
				},
				writeBundle() {
					if (!insertedBuildVersion) {
						throw new Error(
							'Production build version was not set in build-version.ts.'
						);
					}
				},
			};
		})(),
	],

	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'playground-common',
			fileName: 'index',
			// Change this to the formats you want to support.
			// Don't forgot to update your package.json as well.
			formats: ['es', 'cjs'],
		},
		sourcemap: true,
		rollupOptions: {
			external: getExternalModules(),
		},
	},

	test: {
		globals: true,
		cache: {
			dir: '../../../node_modules/.vitest',
		},
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
	},
});
