import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

export * from './lib';

export { PHP, PHPRequestHandler, PHPBrowser } from '@php-wasm/common';
import {
	DataModule,
	EmscriptenOptions,
	loadPHPRuntime as baseLoadPHPRuntime,
	PHPLoaderModule,
} from '@php-wasm/common';

import {
	initOutboundWebsocketProxyServer,
	addSocketOptionsSupportToWebSocketClass,
} from './lib/networking/outbound-ws-to-tcp-proxy.js';
import { addTCPServerToWebSocketServerClass } from './lib/networking/inbound-tcp-to-ws-proxy.js';
import { findFreePorts } from './lib/networking/utils.js';

export async function loadPHPRuntime(
	phpLoaderModule: PHPLoaderModule,
	phpModuleArgs: EmscriptenOptions = {},
	dataDependenciesModules: DataModule[] = []
) {
	const [inboundProxyWsServerPort, outboundProxyWsServerPort] =
		await findFreePorts(2);

	await initOutboundWebsocketProxyServer(outboundProxyWsServerPort);

	return baseLoadPHPRuntime(
		phpLoaderModule,
		{
			websocket: {
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
			...phpModuleArgs,
		},
		dataDependenciesModules
	);
}

// Wildcard re-export is unfortunately not supported by TypeScript.
export type {
	DataModule,
	EmscriptenOptions,
	ErrnoError,
	FileInfo,
	WithFilesystem,
	JavascriptRuntime,
	MountSettings,
	WithPHPIniBindings,
	PHPLoaderModule,
	PHPOutput,
	PHPRequest,
	PHPResponse,
	PHPRuntime,
	PHPRuntimeId,
	PHPServerConfiguration,
	PHPServerRequest,
	WorkerStartupOptions,
} from '@php-wasm/common';
