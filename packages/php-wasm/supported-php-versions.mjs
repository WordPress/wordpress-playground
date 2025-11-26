/**
 * @typedef {Object} PhpVersion
 * @property {string} version
 * @property {string} loaderFilename
 * @property {string} wasmFilename
 * @property {string} lastRelease
 */

export const lastRefreshed = '2025-11-26T18:41:11.405Z';

/**
 * @type {PhpVersion[]}
 * @see https://www.php.net/releases/index.php
 */
export const phpVersions = [
	{
		version: '8.4',
		loaderFilename: 'php_8_4.js',
		wasmFilename: 'php_8_4.wasm',
		lastRelease: '8.4.15',
	},
	{
		version: '8.3',
		loaderFilename: 'php_8_3.js',
		wasmFilename: 'php_8_3.wasm',
		lastRelease: '8.3.28',
	},
	{
		version: '8.2',
		loaderFilename: 'php_8_2.js',
		wasmFilename: 'php_8_2.wasm',
		lastRelease: '8.2.29',
	},
	{
		version: '8.1',
		loaderFilename: 'php_8_1.js',
		wasmFilename: 'php_8_1.wasm',
		lastRelease: '8.1.33',
	},
	{
		version: '8.0',
		loaderFilename: 'php_8_0.js',
		wasmFilename: 'php_8_0.wasm',
		lastRelease: '8.0.30',
	},
	{
		version: '7.4',
		loaderFilename: 'php_7_4.js',
		wasmFilename: 'php_7_4.wasm',
		lastRelease: '7.4.33',
	},
	{
		version: '7.3',
		loaderFilename: 'php_7_3.js',
		wasmFilename: 'php_7_3.wasm',
		lastRelease: '7.3.33',
	},
	{
		version: '7.2',
		loaderFilename: 'php_7_2.js',
		wasmFilename: 'php_7_2.wasm',
		lastRelease: '7.2.34',
	},
];
