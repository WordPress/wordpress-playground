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

export function isomorphicGitBrowserAlias() {
	return {
		find: /^isomorphic-git$/,
		replacement: resolveIsomorphicGitBrowserEsmEntry(),
	};
}

function resolveIsomorphicGitBrowserEsmEntry() {
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

	return (
		resolvePackageExport(packageExport.browser) ||
		resolvePackageExport(packageExport.import)
	);
}
