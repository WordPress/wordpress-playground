import * as babel from '@babel/standalone';
import addImportExtension from './babel-plugin-add-import-extension';
import transpileWordPressImports from './babel-plugin-transpile-wordpress-imports';
import reactRefresh from './babel-plugin-react-refresh';
import * as rollup from '@rollup/browser';
import json from './rollup-plugin-json';
import css from './rollup-plugin-css';
import { MemFile, pathJoin } from '../runnable-code-snippets/fs-utils';
import { extname } from '../runnable-code-snippets/fs-utils';

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
	const filesIndex = files.reduce((acc, file) => {
		acc[file.fileName] = file.contents;
		return acc;
	}, {} as Record<string, string>);

	const prefix = `rollup://localhost/`;
	const relativeEntrypoint = entrypoint.replace(/^\//, '');

	const allUsedWpAssets = new Set<string>();
	const onWpAssetUsed = (asset: string) => allUsedWpAssets.add(asset);
	const generator = await rollup.rollup({
		input: `${prefix}${relativeEntrypoint}`,
		external: ['react'],
		plugins: [
			css({
				transform: (code, id) => {
					const sanitizedId = id.replace(/[^a-zA-Z0-9\-\_]/g, '-');
					const normalizedCssFilename = normalizeRollupFilename(
						id
					).replace(/\.js$/, '');
					let removeCssLink = cssUrlPrefix
						? `
							document.querySelector('link[href*="${pathJoin(
								cssUrlPrefix,
								normalizedCssFilename
							)}"]')?.remove()
						`
						: '';

					return `
					${removeCssLink}
					const existingStyle = document.getElementById('${sanitizedId}');
					if (existingStyle) {
						existingStyle.remove();
					}
					const style = document.createElement('style');
					style.id = '${sanitizedId}';
					style.innerHTML = ${JSON.stringify(code)};
					document.head.appendChild(style);
					`;
				},
			}) as any,
			json({
				include: /\.json$/,
			}) as any,
			{
				name: 'babel-plugin',
				transform(code) {
					return babel.transform(code, {
						plugins: [
							[
								babel.availablePlugins['transform-react-jsx'],
								{
									pragma: 'window.wp.element.createElement',
									pragmaFrag: 'Fragment',
								},
							],
							[addImportExtension, { extension: 'js' }],
							transpileWordPressImports(onWpAssetUsed),
							[reactRefresh, { skipEnvCheck: true }],
						],
					}).code;
				},
			},
			{
				name: 'rollup-dependency-loader',
				resolveId(importee, importer) {
					return new URL(importee, importer).href;
				},
				load(id) {
					const relativePath = id.substring(prefix.length);
					if (!(relativePath in filesIndex)) {
						throw new Error(`Could not find file ${relativePath}`);
					}
					return filesIndex[relativePath];
				},
			},
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

	const builtFileNames = build.output.map((module) => module.fileName);
	const builtCode = build.output
		.map((module) => (module as any).code || (module as any).source || '')
		.join('\n');
	const builtEntrypointFilename = build.output.find((module) =>
		'isEntry' in module ? module.isEntry : false
	)!.fileName;

	return {
		jsBundle: {
			fileName: entrypoint,
			contents: `
			${amdLoader}
			${builtCode}
			require(${JSON.stringify(builtEntrypointFilename)})
			reloadDirtyModules();
			`,
		},
		otherFiles: [
			buildIndexAssetPhp(allUsedWpAssets),
			...files.filter(
				(file) =>
					!['.js'].includes(extname(file.fileName)) &&
					!builtFileNames.includes(file.fileName)
			),
		],
	};
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

function normalizeRollupFilename(name) {
	if (name.startsWith('rollup://localhost/')) {
		name = name.substring('rollup://localhost/'.length);
	}
	if (name.startsWith('_virtual/')) {
		name = name.substring('_virtual/'.length);
	}
	if (name.startsWith('./')) {
		name = name.substring('./'.length);
	}
	return name;
}

/**
 * The amdLoader below is stringified and included in the rollup bundle to
 * make all the define() calls work.
 */
const amdLoader =
	'(' +
	function () {
		if (!('define' in window)) {
			const global: any = window;
			global.__modules = {};
			global.__modulesMeta = {};
			global.define = function define(moduleName, deps, factory) {
				if (typeof deps === 'function') {
					factory = deps;
					deps = [];
				}
				const moduleKey = normalizeModuleKey(moduleName);
				global.__modulesMeta[moduleKey] = {
					deps,
					factory,
					dirty:
						!global.__modulesMeta[moduleKey] ||
						global.__modulesMeta[moduleKey].factory + '' !==
							factory + '',
				};
			};
			global.require = function require(moduleName) {
				const moduleKey = normalizeModuleKey(moduleName);
				if (!global.__modules[moduleKey]) {
					global.__modules[moduleKey] = loadModule(moduleKey);
				}

				return global.__modules[moduleKey];
			};
			global.reloadDirtyModules = function () {
				for (const moduleName in global.__modulesMeta) {
					const mod = global.__modulesMeta[moduleName];
					if (mod.dirty) {
						const exports = loadModule(moduleName);
						global.__modules[moduleName] = exports;

						if (global.isReactRefreshBoundary(exports)) {
							global.__enqueueReactUpdate();
						}
					}
				}
			};

			function normalizeModuleKey(moduleKey) {
				if (moduleKey.startsWith('./')) {
					moduleKey = moduleKey.substring('./'.length);
				}
				if (!moduleKey.endsWith('.js')) {
					moduleKey += '.js';
				}
				return moduleKey;
			}

			function loadModule(moduleName) {
				const meta = global.__modulesMeta[moduleName];
				if (!meta) {
					console.log('global modules meta:', global.__modulesMeta);
					throw new Error(`Could not find module "${moduleName}"`);
				}
				if (meta.dirty) {
					meta.dirty = false;
				}

				let exportIsADependency = false;
				let exports = {};
				const deps = meta.deps.map((dep) => {
					if (dep === 'exports') {
						exportIsADependency = true;
						return exports;
					}
					return global.require(dep);
				});

				// React-fast-refresh support
				let prevRefreshReg = global.$RefreshReg$;
				let prevRefreshSig = global.$RefreshSig$;

				global.$RefreshReg$ = (type, id) => {
					const fullId = JSON.stringify(id) + ' ' + id;
					global.RefreshRuntime.register(type, fullId);
				};
				global.$RefreshSig$ =
					global.RefreshRuntime.createSignatureFunctionForTransform;

				// Run the module factory
				const result = meta.factory(...deps);
				if (!exportIsADependency) {
					exports = result;
				}

				global.$RefreshReg$ = prevRefreshReg;
				global.$RefreshSig$ = prevRefreshSig;

				return exports;
			}
		}
	} +
	')();';
