import addImportExtension from './babel-plugin-add-import-extension';
import transpileWordPressImports from './babel-plugin-transpile-wordpress-imports';
import transpileWordPressJsx from './babel-plugin-transpile-wordpress-jsx';
import reactFastRefresh from './babel-plugin-react-fast-refresh';
import * as rollup from '@rollup/browser';
import * as babel from '@babel/standalone';
import json from './rollup-plugin-json';
import css from './rollup-plugin-css';
import createAmdLoader from './create-amd-loader';
import type { MemFile } from '../runnable-code-snippets/fs-utils';
import { extname } from '../runnable-code-snippets/fs-utils';
import { normalizeRollupFilename } from './common';
import provideDependencies from './rollup-plugin-provide-dependencies';

type Bundle = {
	jsBundle: MemFile;
	otherFiles: MemFile[];
};

interface BundleOptions {
	reloadOnly?: boolean;
}

/**
 * Transpiles WordPress JS code to a format that can be run in the browser.
 *
 * For hot reloading, load the `fast-refresh-runtime-hook.js` script before
 * any other script on the page where the transpiled code will run.
 *
 * @param files The files to transpile.
 * @param entrypoint The entrypoint file name.
 * @param options Bundler options.
 * @returns A list of the transpiled chunks.
 */
export async function bundle(
	files: MemFile[],
	entrypoint: string,
	options: BundleOptions
): Promise<Bundle> {
	const { reloadOnly = false } = options;
	const prefix = `rollup://localhost/`;
	const relativeEntrypoint = entrypoint.replace(/^\//, '');

	const allUsedWpAssets = new Set<string>();
	const onWpAssetUsed = (asset: string) => allUsedWpAssets.add(asset);
	const generator = await rollup.rollup({
		input: `${prefix}${relativeEntrypoint}`,
		external: ['react'],
		// Prevent optimizing away CSS exports:
		treeshake: false,
		plugins: [
			json(),
			css({ idPrefix: prefix }),
			{
				name: 'babel-plugin',
				transform: (code) => babelTranspile(code, onWpAssetUsed).code,
			},
			provideDependencies({ files, inputPrefix: prefix }),
		],
	});

	const build = await generator.generate({
		format: 'amd',
		amd: {
			autoId: true,
			forceJsExtensionForImports: true,
		},
		exports: 'named',
		entryFileNames: '[name].js',
		chunkFileNames: '[name].js',
		assetFileNames: '[name][extname]',
		preserveModules: true,
		sanitizeFileName(name) {
			return normalizeRollupFilename(name).replace(/\.js$/, '');
		},
	});
	return {
		jsBundle: {
			fileName: entrypoint,
			contents: `
			${createAmdLoader({
				reloadOnly,
				entrypoint: getEntrypointFilename(build.output),
			})}
			${concatChunks(build.output)}
			`,
		},
		otherFiles: [
			buildIndexAssetPhp(allUsedWpAssets),
			...reconcileStaticAssets(files, build),
		],
	};
}

type OnWpAssetUsed = (name: string) => any;
export function babelTranspile(
	code: string,
	onWpAssetUsed: OnWpAssetUsed = () => {}
) {
	return (babel as any).transform(code, {
		plugins: [
			transpileWordPressJsx(),
			[addImportExtension, { extension: 'js' }],
			transpileWordPressImports(onWpAssetUsed),
			[reactFastRefresh, { skipEnvCheck: true }],
		],
	});
}

function concatChunks(modules: Array<any>) {
	return modules
		.filter((module) => module.type === 'chunk')
		.map((module) => (module as any).code || (module as any).source || '')
		.join('\n');
}

function getEntrypointFilename(modules: Array<any>) {
	return modules.find((module) =>
		'isEntry' in module ? module.isEntry : false
	)!.fileName;
}

function reconcileStaticAssets(files, build) {
	return files.flatMap((file) => {
		if (['.js'].includes(extname(file.fileName))) {
			return [];
		}
		const builtFile = build.output.find(
			(module) => module.fileName === file.fileName
		);
		if (builtFile?.type === 'asset') {
			return [{ fileName: file.fileName, contents: builtFile.source }];
		}
		return [file];
	});
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
