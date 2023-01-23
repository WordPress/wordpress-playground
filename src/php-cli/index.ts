/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import { startPHP } from '../php-wasm/php-node';
// import { WebSocketServer } from 'ws';

// const wss = new WebSocketServer({
// 	host: '127.0.0.1',
// 	port: 8098,
// });
// wss.on('connection', function connection(ws) {
// 	console.log('Connected!');
// 	ws.send('something');
// 	ws.on('message', function incoming(message) {
// 		console.log('received: %s', message);
// 	});
// });

console.time('Starting');
let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

async function main() {
	const phpVersion = process.env.PHP || '8.2';
	// This dynamic import only works after the build step
	// when the PHP files are present in the same directory
	// as this script.
	console.time('Importing node...');
	const phpLoaderModule = await import(`./php-${phpVersion}.node.js`);
	console.timeEnd('Importing node...');
	console.time('Starting PHP...');
	const php = await startPHP(phpLoaderModule.default, 'NODE', {
		ENV: {
			...process.env,
			TERM: 'xterm',
			TERMINFO: __dirname + '/terminfo',
		},
		websocket: {
			url: (sock, host, port) => {
				const query = new URLSearchParams({ host, port }).toString();
				return `ws://127.0.0.1:8098/?${query}`;
			},
			subprotocol: 'binary',
		},
	});
	console.timeEnd('Starting PHP...');
	console.time('Delaying...');
	setTimeout(() => {
		const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
		if (!hasMinusCOption) {
			args.unshift('-c', __dirname + '/php.ini');
		}
		console.timeEnd('Delaying...');
		console.time('Calling CLI...');
		php.cli(['php', ...args]);
		console.timeEnd('Calling CLI...');
	}, 500);
}
main();
