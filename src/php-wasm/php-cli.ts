import * as phpLoaderModule from '../../build/php-5.6.node.js';
import { startPHP } from './php';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

async function main() {
	const php = await startPHP(phpLoaderModule, 'NODE');
	php.cli(['php', ...process.argv.slice(2)]);
}
main();
