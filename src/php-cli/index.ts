/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import { startPHP } from '../php-wasm/php-node';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

async function main() {
	const phpVersion = process.env.PHP || '8.2';
	// This dynamic import only works after the build step
	// when the PHP files are present in the same directory
	// as this script.
	const phpLoaderModule = await import(`./php-${phpVersion}.node.js`);
	const php = await startPHP(phpLoaderModule.default, 'NODE', {
		ENV: {
			...process.env,
			TERM: 'xterm',
			TERMINFO: __dirname + '/terminfo',
		},
	});
	setTimeout(() => {
		const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
		if (!hasMinusCOption) {
			args.unshift('-c', __dirname + '/php.ini');
		}
		php.cli(['php', ...args]);
	}, 500);
}
main();
