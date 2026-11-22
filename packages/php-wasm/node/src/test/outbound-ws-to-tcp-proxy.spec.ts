import type http from 'node:http';
import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
	COMMAND_CHUNK,
	initOutboundWebsocketProxyServer,
} from '../lib/networking/outbound-ws-to-tcp-proxy';
import { getServerPort } from '../lib/networking/utils';

describe('outbound websocket to TCP proxy', () => {
	let target: net.Server;
	let proxy: http.Server;

	beforeEach(async () => {
		target = net.createServer((socket) => socket.pipe(socket));
		await new Promise<void>((resolve) =>
			target.listen(0, '127.0.0.1', resolve)
		);
		proxy = await initOutboundWebsocketProxyServer(0);
	});

	afterEach(async () => {
		proxy.closeAllConnections();
		await new Promise((resolve) => proxy.close(resolve));
		await new Promise((resolve) => target.close(resolve));
	});

	it('relays TCP traffic for the owning runtime', async () => {
		const client = connect();
		await opened(client);

		client.send(Buffer.from([COMMAND_CHUNK, ...Buffer.from('bar')]));

		expect(await nextMessage(client)).toBe('bar');
		client.close();
	});

	it.each(['https://example.com', 'null'])(
		'closes the connection of the %s browser origin',
		async (origin) => {
			const client = connect(origin);
			client.once('open', () =>
				client.send(Buffer.from([COMMAND_CHUNK, ...Buffer.from('bar')]))
			);

			expect(await closed(client)).toBe(1008);
			expect(await connections(target)).toBe(0);
		}
	);

	it('closes the connection on an unknown command', async () => {
		const client = connect();
		await opened(client);

		client.send(Buffer.from([0xff]));

		expect(await closed(client)).toBe(3000);
	});

	function connect(origin?: string) {
		const params = new URLSearchParams({
			host: '127.0.0.1',
			port: String(getServerPort(target)),
		});
		return new WebSocket(
			`ws://127.0.0.1:${getServerPort(proxy)}/?${params}`,
			{ origin }
		);
	}
});

function opened(client: WebSocket) {
	return new Promise((resolve) => client.once('open', resolve));
}

function nextMessage(client: WebSocket) {
	return new Promise<string>((resolve) =>
		client.once('message', (data) => resolve(data.toString()))
	);
}

function closed(client: WebSocket) {
	return new Promise<number>((resolve) =>
		client.once('close', (code) => resolve(code))
	);
}

function connections(server: net.Server) {
	return new Promise<number>((resolve) =>
		server.getConnections((_, count) => resolve(count))
	);
}
