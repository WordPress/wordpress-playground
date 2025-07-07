/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { join } from 'path';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreWasmImports from '../ignore-wasm-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import ignoreDataImports from '../ignore-data-imports';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildVersionPlugin } from '../../vite-extensions/vite-build-version';

function validateOrigin(origin: string) {
	try {
		const url = new URL(origin);
		if (url.href === `${origin}/`) {
			return true;
		}
	} catch {
		// Let exceptions fall through to the error below
	}

	throw new Error(`Invalid origin: '${origin}'`);
}

const additionalRemoteOriginsModulePath = join(
	__dirname,
	'src/additional-remote-origins.ts'
);

export default defineConfig({
	cacheDir: '../../../node_modules/.vite/playground-client',
	plugins: [
		viteTsConfigPaths({
			root: '../../../',
		}),
		dts({
			entryRoot: 'src',
			tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
			pathsToAliases: false,
		}),
		ignoreWasmImports(),
		ignoreDataImports(),

		// @wp-playground/client doesn't actually use the remote-config virtual
		// module, @wp-playground/remote package does. @wp-playground/client imports
		// a few things from @wp-playground/remote and, even though it doesn't
		// involve the remote-config virtual module, the bundler still needs to know
		// what to do when it sees `import from "virtual:remote-config"`.
		buildVersionPlugin('remote-config'),

		// This plugin allows us to add additional remote origins during build.
		// We could use a virtual module instead, but if we do, we'll need to
		// add it to the vite config of every package that imports it, in order
		// to load those packages in the vite dev server.
		// By using this build transform, we only need to update this vite config.
		{
			name: 'replace-additional-remote-origins-during-build',
			transform(code: string, id: string) {
				if (id !== additionalRemoteOriginsModulePath) {
					return code;
				}
				if (!process.env['ADDITIONAL_REMOTE_ORIGINS']) {
					return code;
				}

				const additionalRemoteOrigins = process.env[
					'ADDITIONAL_REMOTE_ORIGINS'
				]
					.split(',')
					.filter(validateOrigin);
				return `export const additionalRemoteOrigins = ${JSON.stringify(
					additionalRemoteOrigins
				)};`;
			},
		},
	],

	// Configuration for building your library.
	// See: https://vitejs.dev/guide/build.html#library-mode
	build: {
		lib: {
			// Could also be a dictionary or array of multiple entry points.
			entry: './src/index.ts',
			name: 'playground-client',
			fileName: 'index',
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
	},
});
