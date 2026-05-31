import { createServer } from 'net';
import type { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import { debugLog } from './utils';
import type { AddressInfo } from 'net';
function log(...args: any[]) {
	debugLog('[TCP Server]', ...args);
}

export function addTCPServerToWebSocketServerClass(
	WSServer: typeof WebSocketServer
): any {
	return class PHPWasmWebSocketServer extends WSServer {
		constructor(options: any, callback: any) {
			const requestedPort = options.port;
			options.port = 0;
			super(options, callback);
			this.once('listening', () => {
				listenTCPToWSProxy({
					tcpListenPort: requestedPort,
					wsConnectPort: getServerPort(this),
				});
			});
		}
	};
}

function getServerPort(server: WebSocketServer): number {
	const address = server.address();
	if (address === null || typeof address === 'string') {
		throw new Error('WebSocket server address is not available');
	}

	return (address as AddressInfo).port;
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
	const server = createServer();
	server.on('connection', function handleConnection(tcpSource) {
		const inBuffer: Buffer[] = [];

		const wsTarget = new WebSocket(
			`ws://${wsConnectHost}:${wsConnectPort}/`
		);
		wsTarget.binaryType = 'arraybuffer';
		function wsSend(data: Buffer) {
			wsTarget.send(new Uint8Array(data));
		}

		wsTarget.addEventListener('open', function () {
			log('Outbound WebSocket connection established');
			while (inBuffer.length > 0) {
				wsSend(inBuffer.shift()!);
			}
		});
		wsTarget.addEventListener('message', (e) => {
			log(
				'WS->TCP message:',
				new TextDecoder().decode(e.data as ArrayBuffer)
			);
			// @ts-ignore-next-line
			tcpSource.write(Buffer.from(e.data as ArrayBuffer));
		});
		wsTarget.addEventListener('close', () => {
			log('WebSocket connection closed');
			tcpSource.end();
		});

		tcpSource.on('data', function (data) {
			log('TCP->WS message:', data);
			if (wsTarget.readyState === WebSocket.OPEN) {
				while (inBuffer.length > 0) {
					wsSend(inBuffer.shift()!);
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
