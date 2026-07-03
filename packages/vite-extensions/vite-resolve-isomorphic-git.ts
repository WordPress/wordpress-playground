import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

interface PackageJson {
	module?: string;
	dependencies?: Record<string, string>;
	exports?: {
		'.'?:
			| string
			| {
					import?: string | { default?: string };
					default?: string;
			  };
	};
}

export function getIsomorphicGitViteConfig() {
	return {
		optimizeDeps: {
			include: getIsomorphicGitOptimizeDeps(),
			exclude: ['isomorphic-git'],
		},
		resolve: {
			alias: [
				{
					find: /^isomorphic-git$/,
					replacement: resolveIsomorphicGitEsmEntry(),
				},
			],
		},
	};
}

export function resolveIsomorphicGitEsmEntry() {
	const { packageJson, packageRoot } = readIsomorphicGitPackage();
	const entry = getEsmPackageEntry(packageJson);
	return join(packageRoot, entry);
}

function getIsomorphicGitOptimizeDeps() {
	const { packageJson } = readIsomorphicGitPackage();
	const dependencies = Object.keys(packageJson.dependencies ?? {}).filter(
		(dependency) => !isNodeOnlyIsomorphicGitDependency(dependency)
	);
	return [...dependencies, 'buffer', 'ini', 'sha.js/sha1.js'].sort();
}

function readIsomorphicGitPackage() {
	const packageRoot = dirname(require.resolve('isomorphic-git'));
	const packageJson = JSON.parse(
		readFileSync(join(packageRoot, 'package.json'), 'utf8')
	) as PackageJson;
	return { packageJson, packageRoot };
}

function getEsmPackageEntry(packageJson: PackageJson) {
	const rootExport = packageJson.exports?.['.'];
	if (typeof rootExport === 'object') {
		if (typeof rootExport.import === 'string') {
			return rootExport.import;
		}
		if (typeof rootExport.import?.default === 'string') {
			return rootExport.import.default;
		}
	}
	if (packageJson.module) {
		return packageJson.module;
	}
	throw new Error('Could not resolve isomorphic-git ESM entry');
}

function isNodeOnlyIsomorphicGitDependency(dependency: string) {
	return ['minimisted', 'readable-stream', 'simple-get'].includes(dependency);
}
