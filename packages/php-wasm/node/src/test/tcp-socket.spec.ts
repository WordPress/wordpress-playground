import { execFile } from 'node:child_process';
import * as dns from 'dns';
import net from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	OutboundTcpSocket,
	TcpServer,
	getOutboundTcpSocketUrl,
} from '../lib/networking/tcp-socket';

vi.mock('dns', async (importOriginal) => {
	const original = await importOriginal<typeof dns>();
	return { ...original, lookup: vi.fn(original.lookup) };
});

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

	it('drops data and resets the connection after it closes', async () => {
		// The server keeps its side open and keeps writing after the client
		// closes. Only a reset from the client closes the server's socket.
		const server = net.createServer({ allowHalfOpen: true });
		const connection = new Promise<net.Socket>((resolve) =>
			server.once('connection', resolve)
		);
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const { port } = server.address() as net.AddressInfo;
		const socket = new OutboundTcpSocket(
			getOutboundTcpSocketUrl('127.0.0.1', String(port))
		);
		const messages: Buffer[] = [];
		socket.on('message', (data: Buffer) => messages.push(data));
		const serverSocket = await connection;
		serverSocket.on('error', () => {});
		const ended = new Promise((resolve) =>
			serverSocket.once('end', resolve)
		);
		serverSocket.resume();

		socket.close();
		await ended;
		const closed = new Promise((resolve) =>
			serverSocket.once('close', resolve)
		);
		const writes = setInterval(() => {
			if (serverSocket.writable) {
				serverSocket.write('sent after close');
			}
		}, 20);
		try {
			await closed;
		} finally {
			clearInterval(writes);
			server.close();
		}

		expect(messages).toEqual([]);
	});
});

describe('TcpServer', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('does not listen when it closes during a hostname lookup', () => {
		let finishLookup = () => {};
		vi.mocked(dns.lookup).mockImplementationOnce(((
			_hostname: string,
			_options: dns.LookupOptions,
			callback: (error: null, address: string, family: number) => void
		) => {
			finishLookup = () => callback(null, '127.0.0.1', 4);
		}) as typeof dns.lookup);
		const listenSpy = vi.spyOn(net.Server.prototype, 'listen');

		const server = new TcpServer({ host: 'php-wasm.test', port: 0 });
		server.close();
		finishLookup();

		expect(listenSpy).not.toHaveBeenCalled();
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
