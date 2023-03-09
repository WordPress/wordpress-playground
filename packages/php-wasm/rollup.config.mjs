// rollup.config.js
import { globSync } from 'glob';
import fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';

export default [
	{
		input: {
			'service-worker':
				'src/webbrowser-toolkit/service-worker/worker-library.ts',
			'worker-thread':
				'src/webbrowser-toolkit/worker-thread/worker-library.ts',
			php: 'src/index.ts',
		},
		external: ['pnpapi'],
		output: {
			dir: 'build/web',
			format: 'esm',
		},
		plugins: [
			copy({
				targets: [{ src: 'src/webbrowser-toolkit/iframe-worker.html', dest: 'build/web' }],
			}),
			typescript({
				compilerOptions: {
					declarationDir: 'build/web/types',
					outDir: 'build/web/types',
				},
			}),
			url({
				include: ['**/*.wasm'],
			}),
			/**
			 * This plugin ships a copy of every PHP loader files as-is, without the
			 * chunk hash its filename, so that it can be imported by its name in
			 * the consumer package.
			 */
			{
				name: 'export-php-loaders',
				closeBundle() {
					const webDir = new URL('./build/web', import.meta.url)
						.pathname;

					// Map the PHP files
					const phpFiles = globSync(`${webDir}/php-*.js`)
						.filter((path) =>
							path.match(/\/php-\d\.\d-[a-z0-9]+\.js$/)
						)
						.map((path) => {
							const oldFilename = path.split('/').pop();
							const version = oldFilename
								.replace('php-', '')
								.split('-')[0];
							const versionSlug = version.replace('.', '_');
							const newFilename = `php-${version}.js`;

							return {
								version,
								versionSlug,
								oldFilename,
								newFilename,
							};
						});

					// Copy the PHP files without the chunk hash in their filename
					for (const { oldFilename, newFilename } of phpFiles) {
						fs.copyFileSync(
							new URL(
								`./build/web/${oldFilename}`,
								import.meta.url
							).pathname,
							new URL(
								`./build/web/${newFilename}`,
								import.meta.url
							).pathname
						);
					}

					/**
					 * Generate a vite-compatible file that bundles the PHP
					 * loaders and exports their built URLs.
					 */
					const viteExports = phpFiles
						.map(
							({ versionSlug, newFilename }) =>
								`export { default as php${versionSlug} } from './${newFilename}?url';`
						)
						.join('\n');

					fs.writeFileSync(
						new URL('./build/web/vite-loaders.js', import.meta.url)
							.pathname,
						`${viteExports};\n`
					);
				},
			},
		],
	},
	{
		input: {
			php: 'src/index.node.ts',
		},
		external: ['pnpapi'],
		output: {
			dir: 'build/node',
			format: 'cjs',
		},
		plugins: [
			typescript({
				compilerOptions: {
					declarationDir: 'build/node/types',
					outDir: 'build/node/types',
				},
			}),
			url({
				include: ['**/*.wasm'],
			}),
		],
	},
];
