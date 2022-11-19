import addImportExtension from './babel-plugin-add-import-extension';
import transpileWordPressImports from './babel-plugin-transpile-wordpress-imports';
import transpileWordPressJsx from './babel-plugin-transpile-wordpress-jsx';
import reactFastRefresh from './babel-plugin-react-fast-refresh';
import { rollup } from '@rollup/browser';
import json from './rollup-plugin-json';
import css from './rollup-plugin-css';
import createAmdLoader from './create-amd-loader';
import type { MemFile } from '../runnable-code-snippets/fs-utils';
import { extname } from '../runnable-code-snippets/fs-utils';
import { normalizeRollupFilename } from './common';
import provideDependencies from './rollup-plugin-provide-dependencies';
import babelForRollup from './rollup-plugin-babel';

type Bundle = {
	jsBundle: MemFile;
	otherFiles: MemFile[];
};

/**
 * Transpiles WordPress JS code to a format that can be run in the browser.
 *
 * For hot reloading, load the `fast-refresh-runtime-hook.js` script before
 * any other script on the page where the transpiled code will run.
 *
 * @param files The files to transpile.
 * @param entrypoint The entrypoint file name.
 * @returns A list of the transpiled chunks.
 */
export async function bundle(
	files: MemFile[],
	entrypoint: string,
	{ cssUrlPrefix = '' }
): Promise<Bundle> {
	const prefix = `rollup://localhost/`;
	const relativeEntrypoint = entrypoint.replace(/^\//, '');

	const allUsedWpAssets = new Set<string>();
	const onWpAssetUsed = (asset: string) => allUsedWpAssets.add(asset);
	const generator = await rollup({
		input: `${prefix}${relativeEntrypoint}`,
		external: ['react'],
		plugins: [
			css({ cssUrlPrefix }),
			json(),
			babelForRollup({
				plugins: [
					transpileWordPressJsx(),
					[addImportExtension, { extension: 'js' }],
					transpileWordPressImports(onWpAssetUsed),
					[reactFastRefresh, { skipEnvCheck: true }],
				],
			}),
			provideDependencies({ files, inputPrefix: prefix }),
		],
	});

	const build = await generator.generate({
		format: 'amd',
		amd: {
			autoId: true,
			forceJsExtensionForImports: true,
		},
		entryFileNames: '[name].js',
		chunkFileNames: '[name].js',
		assetFileNames: '[name][extname]',
		preserveModules: true,
		sanitizeFileName(name) {
			return normalizeRollupFilename(name).replace(/\.js$/, '');
		},
	});

	return {
		jsBundle: makeJsBundle(build, entrypoint, cssUrlPrefix),
		otherFiles: [
			buildIndexAssetPhp(allUsedWpAssets),
			...extractNonBuiltFiles(files, build),
		],
	};
}

function makeJsBundle(build, entrypoint, cssUrlPrefix) {
	const builtCode = build.output
		.map((module) => (module as any).code || (module as any).source || '')
		.join('\n');
	const builtEntrypointFilename = build.output.find((module) =>
		'isEntry' in module ? module.isEntry : false
	)!.fileName;
	return {
		fileName: entrypoint,
		contents: `
		${createAmdLoader({ cssUrlPrefix })}
		${builtCode}
		require(${JSON.stringify(builtEntrypointFilename)})
		reloadDirtyModules();
		`,
	};
}

function extractNonBuiltFiles(files, build) {
	const builtFileNames = build.output.map((module) => module.fileName);
	return files.filter(
		(file) =>
			!['.js'].includes(extname(file.fileName)) &&
			!builtFileNames.includes(file.fileName)
	);
}

function buildIndexAssetPhp(allUsedWpAssets: Set<string>) {
	const assetsAsPHPArray = Array.from(allUsedWpAssets)
		.map((x) => JSON.stringify(x))
		.join(', ');
	return {
		fileName: 'index.asset.php',
		contents: `<?php return array('dependencies' => array(${assetsAsPHPArray}), 'version' => '6b9f26bada2f399976e5');\n`,
	};
}
