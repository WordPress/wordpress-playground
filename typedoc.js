module.exports = {
	$schema: 'https://typedoc.org/schema.json',
	entryPointStrategy: 'packages',
	entryPoints: [
		'./packages/php-wasm/web',
		'./packages/php-wasm/node',
		'./packages/php-wasm/progress',
		'./packages/php-wasm/universal',
		'./packages/php-wasm/util',
		'./packages/playground/blueprints',
		'./packages/playground/client',
	],
	intentionallyNotExported: [],
	excludeExternals: true,
};
