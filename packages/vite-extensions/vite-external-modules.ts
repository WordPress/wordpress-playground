import glob from 'glob';
import fs from 'fs';

const getPackageNames = (): string[] => {
	const packageJsonPaths = glob
		.sync('../php-wasm/*/package.json')
		.concat(glob.sync('../playground/*/package.json'));
	const packageNames: string[] = [];

	packageJsonPaths.forEach((packageJsonPath) => {
		const packageJson = JSON.parse(
			fs.readFileSync(packageJsonPath, 'utf8')
		);
		packageNames.push(packageJson.name);
	});

	return packageNames;
};

// Usage
const packageNames = getPackageNames();

export const getExternalModules = () => {
	return [
		'yargs',
		'express',
		'crypto',
		'os',
		'net',
		'fs',
		'fs-extra',
		'path',
		'child_process',
		'http',
		'path',
		'tls',
		'util',
		'dns',
		'ws',
		/node_modules\//,
		...packageNames,
	];
};
