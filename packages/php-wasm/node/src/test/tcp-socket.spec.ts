import { execFile } from 'node:child_process';
import dns from 'node:dns';
import net from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	OutboundTcpSocket,
	TcpServer,
	getOutboundTcpSocketUrl,
} from '../lib/networking/tcp-socket';

describe('OutboundTcpSocket', () => {
	it('opens and then closes when the connection is refused', async () => {
		const port = await getClosedPort();
		const socket = new OutboundTcpSocket(
			getOutboundTcpSocketUrl('127.0.0.1', String(port))
		);
		const events: string[] = [];
		socket.on('open', () => events.push('open'));
		socket.on('error', () => events.push('error'));

		await new Promise((resolve) => socket.once('close', resolve));

		expect(events).toEqual(['open']);
		expect(socket.readyState).toBe(OutboundTcpSocket.CLOSED);
	});
});

describe('TcpServer', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('does not listen when it closes during a hostname lookup', async () => {
		const listenSpy = vi.spyOn(net.Server.prototype, 'listen');

		const server = new TcpServer({ host: 'localhost', port: 0 });
		server.close();
		// Let the server's own lookup of the same name finish first.
		await new Promise((resolve) =>
			dns.lookup('localhost', { family: 4 }, resolve)
		);
		await new Promise((resolve) => setTimeout(resolve, 50));

		try {
			expect(listenSpy).not.toHaveBeenCalled();
		} finally {
			server.close();
		}
	});

	it('stops the process when the port is already in use', async () => {
		const blocker = net.createServer();
		await new Promise<void>((resolve) =>
			blocker.listen(0, '127.0.0.1', resolve)
		);
		const { port } = blocker.address() as net.AddressInfo;
		// The error is uncaught by design, so run the server in a child process.
		// Like Emscripten, the script listens for the server's `error` events.
		const repoRoot = path.resolve(__dirname, '../../../../..');
		const loader = path.join(
			repoRoot,
			'packages/meta/src/node-es-module-loader/loader.mts'
		);
		const module = path.join(__dirname, '../lib/networking/tcp-socket.ts');
		const script = `
			import { TcpServer } from ${JSON.stringify(module)};
			const server = new TcpServer({ host: '127.0.0.1', port: ${port} });
			server.on('error', () => {});
			setTimeout(() => process.exit(0), 5000);
		`;
		try {
			const { code, stderr } = await new Promise<{
				code: number;
				stderr: string;
			}>((resolve) => {
				execFile(
					process.execPath,
					[
						'--no-warnings',
						`--loader=${loader}`,
						'--input-type=module',
						'-e',
						script,
					],
					(error, _stdout, stderr) =>
						resolve({ code: Number(error?.code ?? 0), stderr })
				);
			});

			expect(code).not.toBe(0);
			expect(stderr).toContain('EADDRINUSE');
		} finally {
			blocker.close();
		}
	}, 15000);
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
