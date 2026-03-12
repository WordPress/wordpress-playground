import path from 'path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteIgnoreImports } from '../../vite-extensions/vite-ignore-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

export default defineConfig({
	root: __dirname,
	cacheDir: '../../../node_modules/.vite/php-wasm',

	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
		dts({
			entryRoot: 'src',
			tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
			pathsToAliases: false,
		}),
		viteIgnoreImports({
			extensions: ['wasm', 'so'],
		}),
		/*
		 * Externalize the icu.dat import and rewrite its path so the output
		 * contains import('./shared/icu.dat') relative to the dist root.
		 *
		 * In Rolldown (Vite 8), resolveDynamicImport is not called for
		 * files that Rolldown can resolve internally. We intercept via
		 * resolveId instead: when a .dat file resolves to an absolute path,
		 * we mark it as external and rewrite to the desired output path.
		 */
		{
			name: 'externalize-icu-dat',
			enforce: 'pre' as const,
			resolveId(source) {
				if (/icu\.dat$/.test(source)) {
					return { id: './shared/icu.dat', external: true };
				}
				return null;
			},
		},
		...viteGlobalExtensions,
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: 'src/index.ts',
			name: 'php-wasm-web',
			fileName: 'index',
			formats: ['es', 'cjs'],
		},
		sourcemap: true,
		rolldownOptions: {
			// Don't bundle the PHP loaders or extensions in the final build.
			// PHP loaders are now in version-specific packages like @php-wasm/web-8-4
			external: [
				/^@php-wasm\/web-\d+-\d+$/,
				/intl.so$/,
				...getExternalModules(),
			],
		},
	},

	// TODO : move Vitest tests to Playwright tests inside test directory
	test: {
		globals: true,
		environment: 'node',
		reporters: ['default'],
	},
});
