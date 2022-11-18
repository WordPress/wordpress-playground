import React from 'react';
import { render } from 'react-dom';

window.render = render;
window.React = React;
window.react = React;

import * as babel from '@babel/standalone';
import addImportExtension from '../babel-plugin-add-import-extension';
import transpileWordPressImports from '../babel-plugin-transpile-wordpress-imports';
import reactRefresh from '../babel-plugin-react-refresh';

import * as rollup from '@rollup/browser';
import json from '../rollup-plugin-json';
import css from '../rollup-plugin-css';

import './systemjs';

function transpileWordPressJsx(rawCode) {
	const usedWpAssets = [];
	const contents = babel.transform(rawCode, {
		plugins: [
			[babel.availablePlugins['transform-react-jsx']],
			[addImportExtension, { extension: 'js' }],
			// transpileWordPressImports((asset) => usedWpAssets.push(asset)),
			[reactRefresh, { skipEnvCheck: true }],
		],
	}).code;
	return { usedWpAssets, contents };
}

async function bundle(files, entrypoint) {
	files = files.map((file) => {
		const { usedWpAssets, contents } = transpileWordPressJsx(file.contents);
		return {
			...file,
			usedWpAssets,
			contents,
		};
	});

	const filesIndex = files.reduce((acc, file) => {
		acc[file.fileName] = file.contents;
		return acc;
	}, {});

	const prefix = `rollup://localhost/`;
	const relativeEntrypoint = entrypoint.replace(/^\//, '');
	const generator = await rollup.rollup({
		input: `${prefix}${relativeEntrypoint}`,
		external: ['react'],
		plugins: [
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

			json({
				include: /\.json$/,
			}),
			css(),
			{
				name: 'react-live-refresh-wrapper',
				transform(code, id) {
					if (
						id.endsWith('react-refresh/runtime') ||
						id.endsWith('is-react-refresh-boundary') ||
						id.endsWith('systemjs')
					) {
						return code;
					}
					return `
                let prevRefreshReg = window.$RefreshReg$;
                let prevRefreshSig = window.$RefreshSig$;
                
                window.$RefreshReg$ = (type, id) => {
                    const fullId = ${JSON.stringify(id)} + ' ' + id;
                    RefreshRuntime.register(type, fullId);
                }
                window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
                
                ${code}

                window.RefreshRuntime.performReactRefresh();

                window.$RefreshReg$ = prevRefreshReg;
                window.$RefreshSig$ = prevRefreshSig;
                `;
				},
			},
		],
	});
	const build = await generator.generate({
		format: 'cjs',
		manualChunks(id) {
			return id.replace('/', '-').replace(/[^a-zA-Z0-9\-_]/g, '__');
		},
	});

	const chunks = build.output.map((module) => ({
		fileName: module.fileName,
		contents: `${module.code || module.source || ''};`,
	}));
	return chunks;
}

function outputChunk(chunk) {
	const script = document.createElement('script');
	script.innerHTML = `
    define(${JSON.stringify(chunk.fileName)}, (function() {
        let exports = {};
        ${chunk.contents};
        return exports;
    })() );
    `;
	document.body.appendChild(script);
}

async function main() {
	const IndexJs = {
		fileName: 'index.js',
		contents: `
import Component from './component.js';
const wrapper = document.getElementById('test-react-fast-refresh');
let i = 0;
render(<Component nb={++i} />, wrapper);
setInterval(() => {
	render(<Component nb={++i} />, wrapper);
}, 3000);
`,
	};
	const chunks = await bundle(
		[
			IndexJs,
			{
				fileName: 'component.js',
				contents: `
        export default function Component({nb}) {
            const [count, setCount] = React.useState(0);
            React.useEffect(() => {
                if(!window.increased) {
                    window.increased = true;
                    setCount(4);
                }
            });
            return <div>Before refresh {count} {nb}</div>
        }
        `,
			},
		],
		IndexJs.fileName
	);

	chunks
		.filter(({ fileName }) => fileName !== IndexJs.fileName)
		.map(outputChunk);
	chunks
		.filter(({ fileName }) => fileName === IndexJs.fileName)
		.map(outputChunk);

	await new Promise((resolve) => setTimeout(resolve, 10));

	const chunks2 = await bundle(
		[
			IndexJs,
			{
				fileName: 'component.js',
				contents: `
        export default function Component({nb}) {
            const [count, setCount] = React.useState(0);
            React.useEffect(() => {
                if(!window.increased) {
                    window.increased = true;
                    setCount(4);
                }
            });
            return <div>After refresh {count} {nb}</div>
        }
        `,
			},
		],
		IndexJs.fileName
	);
	chunks2
		.filter(({ fileName }) => fileName !== IndexJs.fileName)
		.map(outputChunk);

	console.log({
		hasUnrecoverableErrors: RefreshRuntime.hasUnrecoverableErrors(),
	});
	// chunks2
	// 	.filter(({ fileName }) => fileName === IndexJs.fileName)
	// 	.map(outputChunk);
}

window.mods = {};
window.define = function (name, mod) {
	const key = normalizeName(name);
	if (!(key in mods)) {
		mods[key] = mod;
	}
};

window.require = function (name) {
	return mods[normalizeName(name)];
};

const normalizeName = (name) =>
	name.replace(/\.js$/, '').replace(/^\.\//, '').substr(0, 20) + '.js';

main();
