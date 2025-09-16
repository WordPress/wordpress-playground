import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	type EnvironmentConfig,
	defineConfig,
	type RsbuildPlugin,
} from '@rsbuild/core';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { getExternalModules } from '../../vite-extensions/vite-external-modules';

const filePath = fileURLToPath(import.meta.url);
const cliDir = path.dirname(filePath);
const repoRoot = path.resolve(cliDir, '../../..');
const distRoot = path.join(repoRoot, 'dist/packages/playground/cli');

const tsconfigPath = path.join(repoRoot, 'tsconfig.base.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8')) as {
	compilerOptions?: { paths?: Record<string, string[]> };
};

const aliasEntries = Object.entries(tsconfig.compilerOptions?.paths ?? {})
	.filter(([, values]) => Array.isArray(values) && values.length > 0)
	.map(([key, values]) => [key, path.join(repoRoot, values[0])]);

const alias = Object.fromEntries(aliasEntries);

const sharedEntries = {
	index: new URL('./src/index.ts', import.meta.url).toString(),
	cli: new URL('./src/cli.ts', import.meta.url).toString(),
	'worker-thread-v1': new URL(
		'./src/blueprints-v1/worker-thread-v1.ts',
		import.meta.url
	).toString(),
	'worker-thread-v2': new URL(
		'./src/blueprints-v2/worker-thread-v2.ts',
		import.meta.url
	).toString(),
};

type BuildFormat = 'esm' | 'cjs';

const createLoadersPlugin = (format: BuildFormat): RsbuildPlugin => ({
	name: `playground-cli-loaders-${format}`,
	setup(api) {
		api.modifyRspackConfig((config) => {
			const isCjs = format === 'cjs';

			config.output = {
				...(config.output ?? {}),
				filename: `[name]${isCjs ? '.cjs' : '.js'}`,
				chunkFilename: `[name]-[contenthash]${isCjs ? '.cjs' : '.js'}`,
				clean: !isCjs,
			};

			if (!isCjs) {
				config.experiments = {
					...(config.experiments ?? {}),
					outputModule: true,
				};
			}

			config.target = 'node';

			config.resolve = {
				...(config.resolve ?? {}),
				extensions: [
					'.ts',
					'.tsx',
					'.js',
					'.jsx',
					'.mjs',
					'.cjs',
					'.json',
				],
				alias: {
					...(config.resolve?.alias ?? {}),
					...alias,
				},
			};

			config.externalsType = isCjs ? 'commonjs' : 'module';
			config.externalsPresets = {
				...(config.externalsPresets ?? {}),
				node: true,
			};
			config.externals = getExternalModules();

			const customRules = [
				{
					test: /\.(ini|dat)$/i,
					type: 'asset/resource',
				},
			];

			const existingRules = config.module?.rules ?? [];
			config.module = {
				...(config.module ?? {}),
				rules: [...existingRules, ...customRules],
			};
		});
	},
});

const createEnvironmentConfig = (format: BuildFormat): EnvironmentConfig => {
	return {
		plugins: [createLoadersPlugin(format)],
		source: {
			entry: sharedEntries,
			alias,
		},
		output: {
			distPath: {
				root: distRoot,
			},
			target: 'node',
			sourceMap: true,
			minify: false,
			filenameHash: false,
			cleanDistPath: format === 'esm',
			dataUriLimit: 0,
		},
	};
};

export default defineConfig({
	environments: {
		esm: createEnvironmentConfig('esm'),
		cjs: createEnvironmentConfig('cjs'),
	},
});
