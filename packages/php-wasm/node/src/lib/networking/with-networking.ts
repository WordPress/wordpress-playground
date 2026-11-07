import { logger } from '@php-wasm/logger';
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
	// The runtime releases these when it exits.
	const openHandles = new Set<TcpSocket | TcpServer>();
	const track = (handle: TcpSocket | TcpServer) => {
		openHandles.add(handle);
		// A socket that PHP closed stays open until the peer closes its side,
		// so keep tracking it until the TCP socket itself closes.
		const closeEvents =
			handle instanceof TcpServer ? handle : (handle._socket ?? handle);
		closeEvents.once('close', () => openHandles.delete(handle));
	};

	// Each runtime gets its own classes, so it only releases its own sockets.
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
			// Drain queued writes and bound the lifetime of connections whose
			// peers keep them open. See TcpSocket.release().
			// Release each handle even if another one fails.
			for (const handle of openHandles) {
				try {
					if (handle instanceof TcpServer) {
						handle.close();
					} else {
						handle.release();
					}
				} catch (error) {
					logger.error(
						'Failed to release a network connection',
						error
					);
				}
			}
			// The options above replace one the caller passed in, so call it too.
			phpModuleArgs.closeNetworkConnections?.();
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
