import { createServer, type Server } from 'net';
import type { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import { debugLog, getServerPort } from './utils';
function log(...args: any[]) {
	debugLog('[TCP Server]', ...args);
}

export function addTCPServerToWebSocketServerClass(
	WSServer: typeof WebSocketServer
): any {
	return class PHPWasmWebSocketServer extends WSServer {
		private tcpToWsProxyServer?: Server;
		private closedBeforeTcpProxyStarted = false;

		constructor(options: any, callback: any) {
			const requestedPort = options.port;
			options.port = 0;
			super(options, undefined);
			this.once('listening', () => {
				if (this.closedBeforeTcpProxyStarted) {
					return;
				}
				this.tcpToWsProxyServer = listenTCPToWSProxy(
					{
						tcpListenPort: requestedPort,
						wsConnectPort: getServerPort(this),
					},
					() => callback?.call(this),
					(error) => {
						if (this.closedBeforeTcpProxyStarted) {
							return;
						}
						this.tcpToWsProxyServer = undefined;
						super.close(() => {
							this.emit('error', error);
						});
					}
				);
			});
		}

		override close(callback?: (err?: Error) => void) {
			this.closedBeforeTcpProxyStarted = true;
			const tcpToWsProxyServer = this.tcpToWsProxyServer;
			this.tcpToWsProxyServer = undefined;

			if (!tcpToWsProxyServer) {
				return super.close(callback);
			}

			let pendingCloses = 2;
			let firstError: Error | undefined;
			const finishClose = (error?: Error) => {
				if (
					error &&
					(error as NodeJS.ErrnoException).code !==
						'ERR_SERVER_NOT_RUNNING'
				) {
					firstError ??= error;
					log('TCP server close error', error);
				}
				pendingCloses -= 1;
				if (pendingCloses === 0) {
					callback?.(firstError);
				}
			};

			tcpToWsProxyServer.close(finishClose);
			return super.close(finishClose);
		}
	};
}

export interface InboundTcpToWsProxyOptions {
	tcpListenPort: number;
	wsConnectHost?: string;
	wsConnectPort: number;
}
export function listenTCPToWSProxy(
	options: InboundTcpToWsProxyOptions,
	onListening?: () => void,
	onListenError?: (error: Error) => void
) {
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
		wsTarget.addEventListener('error', (event) => {
			log('WebSocket connection error', event);
			tcpSource.destroy();
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
	const handleListenError = (error: Error) => {
		log('TCP server listen error', error);
		onListenError?.(error);
	};
	let isListening = false;
	const handleRuntimeError = (error: Error) => {
		if (isListening) {
			log('TCP server runtime error', error);
		}
	};
	server.on('error', handleRuntimeError);
	server.once('error', handleListenError);
	server.listen(tcpListenPort, function () {
		isListening = true;
		server.off('error', handleListenError);
		log('TCP server listening');
		onListening?.();
	});
	return server;
}
