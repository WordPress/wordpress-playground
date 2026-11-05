import net from 'node:net';
import { describe, expect, it } from 'vitest';
import {
	OutboundTcpSocket,
	getOutboundTcpSocketUrl,
} from '../lib/networking/outbound-tcp-socket';

describe('OutboundTcpSocket', () => {
	it('reports a refused connection without opening', async () => {
		const port = await getClosedPort();
		const socket = new OutboundTcpSocket(
			getOutboundTcpSocketUrl('127.0.0.1', String(port))
		);
		const events: string[] = [];
		socket.on('open', () => events.push('open'));
		socket.on('error', () => events.push('error'));

		await new Promise((resolve) => socket.once('close', resolve));

		expect(events).toEqual(['error']);
		expect(socket.readyState).toBe(OutboundTcpSocket.CLOSED);
	});
});

async function getClosedPort() {
	const server = net.createServer();
	await new Promise<void>((resolve) =>
		server.listen(0, '127.0.0.1', resolve)
	);
	const { port } = server.address() as net.AddressInfo;
	await new Promise((resolve) => server.close(resolve));
	return port;
}
