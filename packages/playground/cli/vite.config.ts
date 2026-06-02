/// <reference types="vitest" />
import { copyFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';
import { type PluginOption, defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';
// eslint-disable-next-line @nx/enforce-module-boundaries
import viteGlobalExtensions from '../../vite-extensions/vite-global-extensions';

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
	 * Inline worker URLs as string literals so downstream bundlers (e.g., webpack)
	 * can statically analyze `new Worker(new URL('...'))`.
	 *
	 * We emit different extensions per output format:
	 * - ES modules: .js
	 * - CommonJS: .cjs
	 */
	{
		name: 'inline-worker-url-literals',
		renderChunk(code, _chunk, outputOptions) {
			const format = (outputOptions as any).format as string | undefined;
			const isCjs = format === 'cjs';
			const v1 = isCjs
				? './worker-thread-v1.cjs'
				: './worker-thread-v1.js';
			const v2 = isCjs
				? './worker-thread-v2.cjs'
				: './worker-thread-v2.js';
			let transformed = code;
			// Replace macro tokens if used
			transformed = transformed
				.split(/(?<!["'])__WORKER_V1_URL__(?!["'])/g)
				.join(JSON.stringify(v1));
			transformed = transformed
				.split(/(?<!["'])__WORKER_V2_URL__(?!["'])/g)
				.join(JSON.stringify(v2));
			// Replace usages of imported worker URL strings inside new URL(...)
			const patternV1 =
				/new\s+URL\(\s*importedWorkerV1UrlString\s*,\s*import\.meta\.url\s*\)/g;
			const patternV2 =
				/new\s+URL\(\s*importedWorkerV2UrlString\s*,\s*import\.meta\.url\s*\)/g;
			transformed = transformed.replace(
				patternV1,
				`new URL(${JSON.stringify(v1)}, import.meta.url)`
			);
			transformed = transformed.replace(
				patternV2,
				`new URL(${JSON.stringify(v2)}, import.meta.url)`
			);
			if (transformed !== code) {
				return { code: transformed, map: null };
			}
			return null;
		},
	},
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
	/**
	 * Copies the bundled SQLite integration plugin zip into the
	 * output directory so the built CLI can read it at runtime.
	 */
	{
		name: 'copy-sqlite-zip-to-output',

		writeBundle(options) {
			const outputDir = options.dir;
			if (!outputDir) return;

			const require = createRequire(import.meta.url);
			const wpBuildsRoot = dirname(
				require.resolve('@wp-playground/wordpress-builds/package.json')
			);
			copyFileSync(
				join(
					wpBuildsRoot,
					'src',
					'sqlite-database-integration',
					'sqlite-database-integration-trunk.zip'
				),
				join(outputDir, 'sqlite-database-integration.zip')
			);
		},
	},
	...viteGlobalExtensions,
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
	root: __dirname,
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
				entryFileNames: (chunkInfo: any) => {
					// Keep stable filenames for worker threads without hash
					if (
						chunkInfo.name === 'worker-thread-v1' ||
						chunkInfo.name === 'worker-thread-v2'
					) {
						return '[name].js';
					}
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
		include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
		// Increase timeout to:
		// - Ensure CLI tests can download WordPress
		// - Ensure worker threads have time to boot
		testTimeout: 30000,
		poolOptions: {
			forks: {
				execArgv: [
					'--experimental-strip-types',
					'--experimental-transform-types',
					'--disable-warning=ExperimentalWarning',
					// Use our own ESM loader to help resolve modules within the Worker script.
					'--import',
					// Convert path to file:// URL because it is required for running in Windows.
					pathToFileURL(
						join(
							import.meta.dirname,
							'../../meta/src/node-es-module-loader/register.mts'
						)
					).href,
				],
			},
		},
	},
});
