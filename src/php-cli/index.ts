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
		websocket: {
			url: (sock, host, port) => {
				const query = new URLSearchParams({ host, port }).toString();
				return `ws://127.0.0.1:8098/?${query}`;
			},
			subprotocol: 'binary',
			decorator: (WebSocketConstructor) => {
				function prependByte(chunk, byte) {
					if (typeof chunk === 'string') {
						chunk = String.fromCharCode(byte) + chunk;
					} else if (
						chunk instanceof ArrayBuffer ||
						chunk instanceof ArrayBuffer
					) {
						const buffer = new Uint8Array(chunk.byteLength + 1);
						buffer[0] = byte;
						buffer.set(new Uint8Array(chunk), 1);
						chunk = buffer.buffer;
					} else {
						throw new Error('Unsupported chunk type');
					}
					return chunk;
				}
				const COMMAND_CHUNK = 1;
				const COMMAND_SET_SOCKETOPT = 2;
				class PHPWasmWebSocket extends WebSocketConstructor {
					CONNECTING = 0;
					OPEN = 1;
					CLOSING = 2;
					CLOSED = 3;

					send(chunk, callback) {
						return this.sendCommand(COMMAND_CHUNK, chunk, callback);
					}
					setSocketOpt(optionClass, optionName, optionValue) {
						return this.sendCommand(
							COMMAND_SET_SOCKETOPT,
							new Uint8Array([
								optionClass,
								optionName,
								optionValue,
							]).buffer,
							() => {}
						);
					}
					sendCommand(commandType, chunk, callback) {
						return WebSocketConstructor.prototype.send.call(
							this,
							prependByte(chunk, commandType),
							callback
						);
					}
				}
				return PHPWasmWebSocket;
			},
		},
	});
	const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
	if (!hasMinusCOption) {
		args.unshift('-c', __dirname + '/php.ini');
	}
	php.cli(['php', ...args]);
}
main();
