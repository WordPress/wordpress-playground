/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import { startPHP } from '../php-wasm/php-node';
import {
	initWsProxyServer,
	COMMAND_CHUNK,
	COMMAND_SET_SOCKETOPT,
} from './node-network-proxy';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

import { writeFileSync, existsSync } from 'fs';
import { rootCertificates } from 'tls';

// Write the ca-bundle.crt file to disk so that PHP can find it.
const caBundlePath = __dirname + '/ca-bundle.crt';
if (!existsSync(caBundlePath)) {
	writeFileSync(caBundlePath, rootCertificates.join('\n'));
}

const WS_PROXY_HOST = '127.0.0.1';
const WS_PROXY_PORT = 41598;
async function main() {
	const phpVersion = process.env.PHP || '8.2';

	await initWsProxyServer(WS_PROXY_PORT, WS_PROXY_HOST);
	// This dynamic import only works after the build step
	// when the PHP files are present in the same directory
	// as this script.
	const phpLoaderModule = await import(`./php-${phpVersion}.node.js`);
	const php = await startPHP(phpLoaderModule.default, 'NODE', {
		printErr: (msg) => {
			// Emscripten will print this message without exiting when the runtime is
			// shut down, but we really want to exit.
			if (
				msg.includes(
					'due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)'
				)
			) {
				process.exit(process.exitCode || 0);
			}
			console.warn(msg);
		},
		ENV: {
			...process.env,
			TERM: 'xterm',
			TERMINFO: __dirname + '/terminfo',
		},
		websocket: {
			url: (sock, host, port) => {
				const query = new URLSearchParams({ host, port }).toString();
				return `ws://${WS_PROXY_HOST}:${WS_PROXY_PORT}/?${query}`;
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
	args.unshift('-d', `openssl.cafile=${caBundlePath}`);
	php.cli(['php', ...args]);
}
main();
