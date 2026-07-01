import type { EmscriptenOptions } from '@php-wasm/universal';
import type { AddressInfo } from 'net';
import {
	initOutboundWebsocketProxyServer,
	addSocketOptionsSupportToWebSocketClass,
} from './outbound-ws-to-tcp-proxy';
import { addTCPServerToWebSocketServerClass } from './inbound-tcp-to-ws-proxy';
import { findFreePorts } from './utils';

export async function withNetworking(
	phpModuleArgs: EmscriptenOptions = {}
): Promise<EmscriptenOptions> {
	const [inboundProxyWsServerPort] = await findFreePorts(1);

	const outboundNetworkProxyServer =
		await initOutboundWebsocketProxyServer(0);
	const outboundProxyWsServerPort = (
		outboundNetworkProxyServer.address() as AddressInfo
	).port;

	return {
		...phpModuleArgs,
		outboundNetworkProxyServer,
		websocket: {
			...(phpModuleArgs['websocket'] || {}),
			url: (_: any, host: string, port: string) => {
				const query = new URLSearchParams({
					host,
					port,
				}).toString();
				return `ws://127.0.0.1:${outboundProxyWsServerPort}/?${query}`;
			},
			subprotocol: 'binary',
			decorator: addSocketOptionsSupportToWebSocketClass,
			serverDecorator: addTCPServerToWebSocketServerClass.bind(
				null,
				inboundProxyWsServerPort
			),
		},
	};
}
