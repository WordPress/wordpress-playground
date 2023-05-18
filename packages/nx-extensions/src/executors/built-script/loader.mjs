import { createRequire, _resolveFilename } from 'module';
import { dirname } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { resolve as tsNodeResolve } from 'ts-node/esm';
import { globSync } from 'glob';

import devkit from '@nx/devkit';

const nxBaseDir = process.cwd();
const require = createRequire(nxBaseDir + '/');
const resolvedPackages = {};
for (const packageJson of globSync([
	nxBaseDir + '/dist/packages/*/package.json',
	nxBaseDir + '/dist/packages/*/*/package.json',
])) {
	const json = require(packageJson);
	const filename = json.module || json.main || 'index.js';
	resolvedPackages[json.name] = dirname(packageJson) + '/' + filename;
}

export async function resolve(specifier, context, nextResolve) {
	let refinedSpecifier = specifier;

	// use NX's lib paths to resolve local packages
	if (resolvedPackages[specifier]) {
		refinedSpecifier = resolvedPackages[specifier];
	}

	// if there's no extension and the path is relative
	// try using commonjs's loader to find the file path
	if (!/\.[cm]?[jt]s$/.test(specifier) && /^\.\.?\//.test(specifier)) {
		const path = dirname(fileURLToPath(context.parentURL));
		refinedSpecifier = require.resolve(specifier, {
			paths: [path],
		});
	}

	return await tsNodeResolve(refinedSpecifier, context, nextResolve);
}
