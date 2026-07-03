import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

interface PackageJson {
	module?: string;
	exports?: {
		'.'?:
			| string
			| {
					import?: string | { default?: string };
					default?: string;
			  };
	};
}

export function resolveIsomorphicGitEsmEntry() {
	const packageRoot = dirname(require.resolve('isomorphic-git'));
	const packageJson = JSON.parse(
		readFileSync(join(packageRoot, 'package.json'), 'utf8')
	) as PackageJson;
	const entry = getEsmPackageEntry(packageJson);
	return join(packageRoot, entry);
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
