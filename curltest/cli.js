#!/usr/bin/env node

// import { NodePHP } from '@php-wasm/node';
import { NodePHP } from '../dist/packages/php-wasm/node/index.cjs';

NodePHP.load('8.0')
	.then((php) => {
		php.setPhpIniEntry('allow_url_fopen', '1');
		php.setPhpIniEntry('disable_functions', '');
		php.useHostFilesystem();

		// return php.run({
		//     code: `<?php
		//     echo file_get_contents('https://wordpress.org');
		//     `
		// });
		return php.cli(['php', ...process.argv.slice(2)]);
	})
	.catch((e) => {
		console.error(e);
	});
