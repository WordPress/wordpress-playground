import net from 'net';
import { WebSocket } from 'ws';
import { debugLog } from './utils';

export function addTCPServerToWebSocketServerClass(
	wsListenPort,
	WebSocketServer
) {
	return class PHPWasmWebSocketServer extends WebSocketServer {
		constructor(options, callback) {
			const requestedPort = options.port;
			options.port = wsListenPort;
			listenTCPToWSProxy({
				tcpListenPort: requestedPort,
				wsConnectPort: wsListenPort,
			});
			super(options, callback);
		}
	};
}

function log(...args) {
	debugLog('[TCP Server]', ...args);
}

export interface InboundTcpToWsProxyOptions {
	tcpListenPort: number;
	wsConnectHost?: string;
	wsConnectPort: number;
}
export function listenTCPToWSProxy(options: InboundTcpToWsProxyOptions) {
	options = {
		wsConnectHost: '127.0.0.1',
		...options,
	};
	const { tcpListenPort, wsConnectHost, wsConnectPort } = options;
	const server = net.createServer();
	server.on('connection', function handleConnection(tcpSource) {
		const inBuffer: Buffer[] = [];

		const wsTarget = new WebSocket(
			`ws://${wsConnectHost}:${wsConnectPort}/`
		);
		wsTarget.binaryType = 'arraybuffer';
		function wsSend(data) {
			wsTarget.send(new Uint8Array(data));
		}

		wsTarget.addEventListener('open', function () {
			log('Outbound WebSocket connection established');
			while (inBuffer.length > 0) {
				wsSend(inBuffer.shift());
			}
		});
		wsTarget.addEventListener('message', (e) => {
			log('WS->TCP message:', new TextDecoder().decode(e.data));
			tcpSource.write(Buffer.from(e.data));
		});
		wsTarget.addEventListener('close', () => {
			log('WebSocket connection closed');
			tcpSource.end();
		});

		tcpSource.on('data', function (data) {
			log('TCP->WS message:', data);
			if (wsTarget.readyState === WebSocket.OPEN) {
				while (inBuffer.length > 0) {
					wsSend(inBuffer.shift());
				}
				wsSend(data);
			} else {
				inBuffer.push(data);
			}
		});
		tcpSource.once('close', function () {
			log('TCP connection closed');
			wsTarget.close();
		});
		tcpSource.on('error', function () {
			log('TCP connection error');
			wsTarget.close();
		});
	});
	server.listen(tcpListenPort, function () {
		log('TCP server listening');
	});
}
