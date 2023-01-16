import * as phpLoaderModule from '../../build/php-7.4.node.js';
import { startPHP } from './php';
import type { startPHP } from './php';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

async function main() {
	const php = await startPHP(phpLoaderModule, 'NODE');
	console.log('hani');

	// php.run({
	// 	code: `<?php readline();`,
	// });
	php.cli(['php', ...process.argv.slice(2)]);
	process.stdout.write('\n');
}
main();
