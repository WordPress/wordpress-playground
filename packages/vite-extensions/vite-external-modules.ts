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
		/^@php-wasm\//,
		/^@wp-playground\//,
	];
};
