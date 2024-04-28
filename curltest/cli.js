#!/usr/bin/env node

// import { NodePHP } from '@php-wasm/node';
import { NodePHP } from '../dist/packages/php-wasm/node/index.cjs';

NodePHP.load('8.0').then((php) => {
	php.setPhpIniEntry('disable_functions', '');
	php.useHostFilesystem();

	return php.cli(['php', ...process.argv.slice(2)]);
});
