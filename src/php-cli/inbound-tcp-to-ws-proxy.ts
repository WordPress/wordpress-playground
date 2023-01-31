import net from 'net';
import { WebSocket } from 'ws';

export interface InboundTcpToWsProxyOptions {
	tcpListenHost?: string;
	tcpListenPort: number;
	wsConnectHost?: string;
	wsConnectPort: number;
}
export function listenTCPToWSProxy(options: InboundTcpToWsProxyOptions) {
	options = {
		tcpListenHost: '127.0.0.1',
		wsConnectHost: '127.0.0.1',
		...options,
	};
	const { tcpListenHost, tcpListenPort, wsConnectHost, wsConnectPort } =
		options;
	const server = net.createServer();
	server.on('connection', function handleConnection(conn) {
		const inBuffer: Buffer[] = [];

		const target = new WebSocket(`ws://${wsConnectHost}:${wsConnectPort}/`);
		target.binaryType = 'arraybuffer';
		target.addEventListener('open', function () {
			while (inBuffer.length > 0) {
				send(inBuffer.shift());
			}
		});

		target.addEventListener('message', (e) => {
			conn.write(Buffer.from(e.data));
		});

		function send(data) {
			target.send(new Uint8Array(data));
		}

		conn.on('data', function (data) {
			if (target.readyState === WebSocket.OPEN) {
				while (inBuffer.length > 0) {
					send(inBuffer.shift());
				}
				send(data);
			} else {
				inBuffer.push(data);
			}
		});
		conn.once('close', function () {
			target.close();
		});
		conn.on('error', function () {
			target.close();
		});
	});
	server.listen(tcpListenPort, tcpListenHost, function () {
		console.log('TCP server listening');
	});
}
