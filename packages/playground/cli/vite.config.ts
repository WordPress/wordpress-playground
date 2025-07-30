/// <reference types="vitest" />
import { join } from 'path';
import { type PluginOption, defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

/**
 * @TODO: Consider rsbuild for this:
 * import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    assetsInclude: /\.dat$/,
  },
  output: {
    dataUriLimit: 0,
    chunkFormat: "commonjs",
    target,
  },
  module: {
    rules: [
      {
        test: /\.dat/,
        use: [
          {
            loader: "url-loader",
          },
        ],
        type: "asset/inline",
      },
    ],
  },
});

 */
const plugins = [
	dts({
		entryRoot: 'src',
		tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
		pathsToAliases: false,
	}),

	viteTsConfigPaths({
		root: '../../../',
	}),
	/**
	 * In library mode, Vite bundles all `?url` imports as JS modules with a single,
	 * base64 export. blueprints.phar is too large for that. We need to preserve it
	 * as an actual file.
	 *
	 * ... more comment tbd ...
	 *
	 * @see https://github.com/vitejs/vite/issues/3295
	 */
	{
		name: 'build-phars-as-URL-modules-not-data-imports',

		transform(code, id) {
			if (id?.includes('.phar')) {
				// @TODO don't hardcode it
				// @TODO use URL on the web and path on Node.js
				return {
					code: `
						import { fileURLToPath } from 'url';
						import { dirname, join } from 'path';
						
						let pharPath;
						if (typeof __dirname !== 'undefined') {
							// CommonJS
							pharPath = join(__dirname, "./blueprints.phar");
						} else {
							// ESM
							pharPath = join(import.meta.dirname, "./blueprints.phar");
						}
						
						export default pharPath;
					`,
					map: null,
				};
			}
		},
	},
] as PluginOption[];

const external = [
	...getExternalModules(),
	'@php-wasm/node',
	'@php-wasm/web',
	'@php-wasm/universal',
	'@php-wasm/logger',
	'@php-wasm/progress',
	'@php-wasm/util',
	'@wp-playground/wordpress',
	'@wp-playground/common',
	'@wp-playground/blueprints',
];

export default defineConfig({
	base: './',
	assetsInclude: ['**/*.ini'],
	cacheDir: '../../../node_modules/.vite/php-cli',

	plugins,

	worker: {
		format: 'es',
		plugins: () => plugins,
		rollupOptions: {
			external,
			output: {
				entryFileNames: (/* chunkInfo: any */) => {
					return '[name]-[hash].js';
				},
			},
		},
	},

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		assetsDir: '',
		assetsInlineLimit: 0,
		target: 'es2020',
		sourcemap: true,
		rollupOptions: {
			external,
		},
		lib: {
			entry: {
				index: 'src/index.ts',
				cli: 'src/cli.ts',
				'worker-thread-v1': 'src/blueprints-v1/worker-thread-v1.ts',
				'worker-thread-v2': 'src/blueprints-v2/worker-thread-v2.ts',
			},
			name: 'playground-cli',
			formats: ['es', 'cjs'],
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
		testTimeout: 15000, // Increase timeout to ensure CLI tests can download WordPress
	},
});
