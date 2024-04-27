#!/usr/bin/env node

// import { NodePHP } from '@php-wasm/node';
import { NodePHP } from '../dist/packages/php-wasm/node/index.cjs';

NodePHP.load('8.0').then((php) => {
	php.useHostFilesystem();

	php.cli(['php', ...process.argv.slice(2)])
		.catch((result) => {
			throw result;
		})
		.finally(() => process.exit(0));
});
