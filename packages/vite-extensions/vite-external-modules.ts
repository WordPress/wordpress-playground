import packageJson from '../../package.json';

const deps = [
	...Object.keys(packageJson.dependencies || {}),
	...Object.keys(packageJson.devDependencies || {}),
	// NOTE: We may or may not currently have optionalDependencies,
	// but let's make sure we handle them when they exist.
	...Object.keys((packageJson as any).optionalDependencies || {}),
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
		'module',
		'fs-ext-extra-prebuilt',
		'path',
		'child_process',
		'http',
		'path',
		'stream',
		'stream/promises',
		'tls',
		'util',
		'dns',
		'ws',
		'readline',
		'worker_threads',
		'url',
		'node:crypto',
		'node:http',
		'node:net',
		'node:process',
		/^@php-wasm\//,
		/^@wp-playground\//,
		...deps,
	];
};
