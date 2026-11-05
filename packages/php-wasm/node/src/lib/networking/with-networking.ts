import type { EmscriptenOptions } from '@php-wasm/universal';
// The compiled PHP runtime calls require('ws') before it passes the `ws`
// classes to the decorators below, so the package must keep depending on it.
import 'ws';
import type { TcpServerOptions } from './tcp-socket';
import {
	OutboundTcpSocket,
	TcpServer,
	type TcpSocket,
	getOutboundTcpSocketUrl,
} from './tcp-socket';

export async function withNetworking(
	phpModuleArgs: EmscriptenOptions = {}
): Promise<EmscriptenOptions> {
	// The runtime closes these when it exits.
	const openHandles = new Set<TcpSocket | TcpServer>();
	const track = (handle: TcpSocket | TcpServer) => {
		openHandles.add(handle);
		handle.once('close', () => openHandles.delete(handle));
	};

	class RuntimeOutboundTcpSocket extends OutboundTcpSocket {
		constructor(url: string) {
			super(url);
			track(this);
		}
	}

	class RuntimeTcpServer extends TcpServer {
		constructor(options: TcpServerOptions) {
			super(options);
			track(this);
			this.on('connection', track);
		}
	}

	return {
		...phpModuleArgs,
		closeNetworkConnections: () => {
			for (const handle of openHandles) {
				handle.close();
			}
		},
		websocket: {
			...(phpModuleArgs['websocket'] || {}),
			url: (_: any, host: string, port: string) =>
				getOutboundTcpSocketUrl(host, port),
			subprotocol: 'binary',
			// Emscripten passes the `ws` classes to these decorators. PHP's
			// sockets use TCP directly instead of local WebSocket servers.
			decorator: () => RuntimeOutboundTcpSocket,
			serverDecorator: () => RuntimeTcpServer,
		},
	};
}
