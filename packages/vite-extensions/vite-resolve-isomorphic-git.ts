import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

interface PackageJson {
	name?: string;
	browser?: string | Record<string, string | false>;
	module?: string;
	exports?: {
		'.'?: PackageExport;
	};
}

type PackageExport =
	| string
	| {
			browser?: PackageExport;
			import?: PackageExport;
			default?: PackageExport;
	  };

/**
 * Forces bare `isomorphic-git` imports to start from the browser ESM entry.
 *
 * Vite's dependency optimizer may otherwise resolve the package through
 * `exports["."].default`, which is currently `index.cjs`. That CJS entry
 * imports Node `crypto`, so browser builds can end up with Vite's
 * `browser-external:crypto` stub.
 *
 * Keep the workaround at the package boundary instead of listing
 * `isomorphic-git`'s current dependencies in every consumer. Dependencies
 * such as `crc-32`, `pako`, or `sha.js` are still resolved normally from
 * `isomorphic-git`'s ESM imports, and any other package that imports those
 * dependencies gets Vite's normal resolution/optimization behavior.
 */
export function isomorphicGitBrowserAlias() {
	return {
		find: /^isomorphic-git$/,
		replacement: resolveIsomorphicGitBrowserEsmEntry(),
	};
}

function resolveIsomorphicGitBrowserEsmEntry() {
	/**
	 * `isomorphic-git/package.json` is not exported, and bare
	 * `require.resolve('isomorphic-git')` intentionally follows the package's
	 * default CJS entry. Use that resolved file only as an anchor to find the
	 * package root, then choose the browser ESM entry from package metadata.
	 */
	const packageRoot = findPackageRoot(
		require.resolve('isomorphic-git'),
		'isomorphic-git'
	);
	const packageJson = readPackageJson(packageRoot);
	const entry = getBrowserEsmPackageEntry(packageJson);
	return join(packageRoot, entry);
}

function findPackageRoot(resolvedPath: string, packageName: string) {
	let directory = dirname(resolvedPath);

	while (directory !== dirname(directory)) {
		const packageJsonPath = join(directory, 'package.json');
		if (existsSync(packageJsonPath)) {
			const packageJson = readPackageJson(directory);
			if (packageJson.name === packageName) {
				return directory;
			}
		}
		directory = dirname(directory);
	}

	throw new Error(`Could not find ${packageName} package root`);
}

function readPackageJson(packageRoot: string) {
	return JSON.parse(
		readFileSync(join(packageRoot, 'package.json'), 'utf8')
	) as PackageJson;
}

function getBrowserEsmPackageEntry(packageJson: PackageJson): string {
	if (typeof packageJson.browser === 'string') {
		return packageJson.browser;
	}

	const exportEntry = resolvePackageExport(packageJson.exports?.['.']);
	if (exportEntry) {
		return exportEntry;
	}

	if (packageJson.module) {
		return packageJson.module;
	}

	throw new Error('Could not resolve isomorphic-git browser ESM entry');
}

function resolvePackageExport(
	packageExport: PackageExport | undefined
): string | undefined {
	if (!packageExport || typeof packageExport === 'string') {
		return packageExport;
	}

	/**
	 * Do not fall back to `default`: in the current `isomorphic-git` package,
	 * that is the Node/CJS entry this alias is meant to avoid.
	 */
	return (
		resolvePackageExport(packageExport.browser) ||
		resolvePackageExport(packageExport.import)
	);
}
