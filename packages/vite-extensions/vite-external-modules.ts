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
		'fs/promises',
		'node:fs',
		'node:fs/promises',
		'fs-extra',
		'path',
		'child_process',
		'http',
		'path',
		'tls',
		'util',
		'dns',
		'ws',
		'readline',
		'worker_threads',
		'url',
		/^@php-wasm\//,
		/^@wp-playground\//,
		...deps,
	];
};
