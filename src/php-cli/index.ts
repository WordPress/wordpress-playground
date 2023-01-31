/**
 * A CLI script that runs PHP CLI via the WebAssembly build.
 */
import net from 'net';
import { startPHP } from '../php-wasm/php-node';
import {
	initWsProxyServer,
	COMMAND_CHUNK,
	COMMAND_SET_SOCKETOPT,
} from './outbound-ws-to-tcp-proxy';
import { WebSocket } from 'ws';

let args = process.argv.slice(2);
if (!args.length) {
	args = ['--help'];
}

import { writeFileSync, existsSync } from 'fs';
import { rootCertificates } from 'tls';
import { listenTCPToWSProxy } from './inbound-tcp-to-ws-proxy';

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
		ENV: {
			...process.env,
			TERM: 'xterm',
		},
		websocket: {
			url: (sock, host, port) => {
				const query = new URLSearchParams({ host, port }).toString();
				return `ws://${WS_PROXY_HOST}:${WS_PROXY_PORT}/?${query}`;
			},
			subprotocol: 'binary',
			decorator: addSocketOptsSupportToWebSocketClass,
			serverDecorator: function httpServerDecorator(WebSocketServer) {
				class PHPWasmWebSocketServer extends WebSocketServer {
					constructor(options, callback) {
						const requestedPort = options.port;
						const assignedPort = 41599;
						options.port = assignedPort;
						listenTCPToWSProxy({
							tcpListenPort: requestedPort,
							wsConnectPort: assignedPort,
						});
						super(options, callback);
					}
				}
				return PHPWasmWebSocketServer;
			},
		},
	});
	const hasMinusCOption = args.some((arg) => arg.startsWith('-c'));
	if (!hasMinusCOption) {
		args.unshift('-c', __dirname + '/php.ini');
	}
	php.writeFile(caBundlePath, rootCertificates.join('\n'));
	args.unshift('-d', `openssl.cafile=${caBundlePath}`);
	php.cli(['php', ...args]).catch((result) => {
		if (result.name === 'ExitStatus') {
			process.exit(result.status === undefined ? 1 : result.status);
		}
		throw result;
	});
}
main();

setTimeout(() => {
	// 	const ws = new WebSocket(`ws://127.0.0.1:49870`);
	// 	ws.binaryType = 'arraybuffer';
	// 	ws.on('open', () => {
	// 		console.log('open');
	// 		ws.send(
	// 			new TextEncoder().encode(`GET /esbuild.js HTTP/1.1
	// Host: 127.0.0.1:49870
	// Connection: keep-alive
	// Cache-control: max-age=0
	// Content-length: 0
	// User-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36
	// Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
	// Accept-encoding: gzip, deflate, br
	// Accept-language: pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7
	// \r\n`)
	// 		);
	// 	});
	// 	ws.on('message', (data) => {
	// 		console.log('message', new TextDecoder().decode(data));
	// 	});
	// console.log('request!');
	// http.request(
	// 	{
	// 		host: '127.0.0.1',
	// 		port: 49810,
	// 		method: 'GET',
	// 		path: '/esbuild.js',
	// 		headers: {
	// 			'Content-Type': 'text/plain',
	// 		},
	// 	},
	// 	(res) => {
	// 		console.log(res.statusCode);
	// 		res.on('data', (data) => {
	// 			console.log(data.toString());
	// 		});
	// 	}
	// ).end();
}, 1300);
/**
 * Decorates the WebSocket class to support socket options.
 * It does so by using a very specific data transmission protocol
 * supported by the ./node-network-proxy server. The first byte
 * of every message is a command type, and the remaining bytes
 * are the actual data. The command types are defined in
 * ./node-network-proxy.
 *
 * @param  WebSocketConstructor
 * @returns Decorated constructor
 */
function addSocketOptsSupportToWebSocketClass(WebSocketConstructor) {
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
	class PHPWasmWebSocketConstructor extends WebSocketConstructor {
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
				new Uint8Array([optionClass, optionName, optionValue]).buffer,
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
	return PHPWasmWebSocketConstructor;
}
