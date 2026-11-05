import type { EmscriptenOptions } from '@php-wasm/universal';
import {
	createOutboundTcpSocketClass,
	getOutboundTcpSocketUrl,
} from './outbound-tcp-socket';
import { addTCPServerToWebSocketServerClass } from './inbound-tcp-to-ws-proxy';

export async function withNetworking(
	phpModuleArgs: EmscriptenOptions = {}
): Promise<EmscriptenOptions> {
	const OutboundTcpSocket = createOutboundTcpSocketClass();

	return {
		...phpModuleArgs,
		closeOutboundConnections: () => OutboundTcpSocket.closeAll(),
		websocket: {
			...(phpModuleArgs['websocket'] || {}),
			url: (_: any, host: string, port: string) =>
				getOutboundTcpSocketUrl(host, port),
			subprotocol: 'binary',
			// Emscripten passes the `ws` WebSocket class here. Outbound
			// connections use TCP directly instead of a local WebSocket server.
			decorator: () => OutboundTcpSocket,
			serverDecorator: addTCPServerToWebSocketServerClass,
		},
	};
}
