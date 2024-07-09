import packageJson from '../../package.json';

const deps = [
	...Object.keys(packageJson.dependencies || {}),
	...Object.keys(packageJson.devDependencies || {}),
];
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
		/^@php-wasm\//,
		/^@wp-playground\//,
		...deps,
	];
};
