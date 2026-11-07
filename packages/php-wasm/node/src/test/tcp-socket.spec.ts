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

	it('drops data that arrives after it closes', async () => {
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
		const ended = new Promise((resolve) =>
			serverSocket.once('end', resolve)
		);
		serverSocket.resume();

		socket.close();
		await ended;
		await new Promise<void>((resolve) =>
			serverSocket.write('sent after close', () => resolve())
		);
		await new Promise((resolve) => setTimeout(resolve, 50));
		serverSocket.destroy();
		server.close();

		expect(messages).toEqual([]);
	});

	it('sends everything written before it closes while the peer keeps sending', async () => {
		// The server stops reading, so the writes stay buffered when the socket
		// closes, and keeps sending. A reset at that point would make the
		// kernel discard writes the server hasn't received yet.
		const size = 16 * 1024 * 1024;
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
		await new Promise((resolve) => socket.once('open', resolve));
		const serverSocket = await connection;
		serverSocket.pause();
		serverSocket.on('error', () => {});
		let received = 0;
		const ended = new Promise((resolve) => {
			serverSocket.on('data', (data) => (received += data.length));
			serverSocket.once('end', resolve);
			serverSocket.once('close', resolve);
		});

		socket.send(new Uint8Array(size));
		socket.close();
		const writes = setInterval(() => {
			if (serverSocket.writable) {
				serverSocket.write(Buffer.alloc(1024));
			}
		}, 1);
		try {
			await new Promise((resolve) => setTimeout(resolve, 100));
			serverSocket.resume();
			await ended;
		} finally {
			clearInterval(writes);
			serverSocket.destroy();
			server.close();
		}

		expect(received).toBe(size);
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

		expect(dns.lookup).toHaveBeenCalled();
		expect(listenSpy).not.toHaveBeenCalled();
	});

	it('drops a connection that has no remote address', async () => {
		const server = new TcpServer({ host: '127.0.0.1', port: 0 });
		await new Promise((resolve) => server.once('listening', resolve));
		const onConnection = vi.fn();
		server.on('connection', onConnection);
		// A connection reset before Node.js handles it has no remote address,
		// like a socket that was never connected.
		const socket = new net.Socket();
		const destroy = vi.spyOn(socket, 'destroy');

		try {
			(server as unknown as { server: net.Server }).server.emit(
				'connection',
				socket
			);
		} finally {
			server.close();
		}

		expect(destroy).toHaveBeenCalled();
		expect(onConnection).not.toHaveBeenCalled();
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
