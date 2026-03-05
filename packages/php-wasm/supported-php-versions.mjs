/**
 * @typedef {Object} PhpVersion
 * @property {string} version
 * @property {string} loaderFilename
 * @property {string} wasmFilename
 * @property {string} lastRelease
 */

export const lastRefreshed = "2026-03-02T17:19:10.584Z";

/**
 * @type {PhpVersion[]}
 * @see https://www.php.net/releases/index.php
 */
export const phpVersions = [
	{
		version: '8.5',
		loaderFilename: 'php_8_5.js',
		wasmFilename: 'php_8_5.wasm',
		lastRelease: '8.5.3',
	},
	{
		version: '8.4',
		loaderFilename: 'php_8_4.js',
		wasmFilename: 'php_8_4.wasm',
		lastRelease: '8.4.18',
	},
	{
		version: '8.3',
		loaderFilename: 'php_8_3.js',
		wasmFilename: 'php_8_3.wasm',
		lastRelease: '8.3.30',
	},
	{
		version: '8.2',
		loaderFilename: 'php_8_2.js',
		wasmFilename: 'php_8_2.wasm',
		lastRelease: '8.2.30',
	},
	{
		version: '8.1',
		loaderFilename: 'php_8_1.js',
		wasmFilename: 'php_8_1.wasm',
		lastRelease: '8.1.34',
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
	}
];
