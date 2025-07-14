import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server as NetServer, Socket } from 'net';
import WebSocket from 'ws';
import type { WebSocket as WSWebSocket } from 'ws';
import {
	initOutboundWebsocketProxyServer,
	addSocketOptionsSupportToWebSocketClass,
	COMMAND_CHUNK,
	COMMAND_SET_SOCKETOPT,
} from '../outbound-ws-to-tcp-proxy';

// Mock the debug log to avoid console output during tests
vi.mock('../utils', () => ({
	debugLog: vi.fn(),
}));

describe('WebSocket to TCP Proxy', () => {
	let proxyServer: any;
	let mockTcpServer: NetServer;
	let proxyPort: number;
	let tcpPort: number;
	const testHost = '127.0.0.1';

	beforeEach(async () => {
		// Find available ports
		proxyPort = await getAvailablePort();
		tcpPort = await getAvailablePort(proxyPort + 1);

		// Create a mock TCP server
		mockTcpServer = new NetServer();
		await new Promise<void>((resolve) => {
			mockTcpServer.listen(tcpPort, testHost, resolve);
		});

		// Create the WebSocket proxy server
		proxyServer = await initOutboundWebsocketProxyServer(
			proxyPort,
			testHost
		);
	});

	afterEach(() => {
		if (proxyServer) {
			proxyServer.close();
		}
		if (mockTcpServer) {
			mockTcpServer.close();
		}
	});

	it('should handle three concurrent WebSocket connections', async () => {
		const connections: Array<{
			tcpSocket: Socket;
			wsClient: WebSocket;
			receivedData: Buffer[];
		}> = [];

		// Set up mock TCP server to echo data back
		mockTcpServer.on('connection', (socket: Socket) => {
			const connectionIndex = connections.findIndex(
				(conn) => !conn.tcpSocket
			);
			if (connectionIndex >= 0) {
				connections[connectionIndex].tcpSocket = socket;
			}

			socket.on('data', (data: Buffer) => {
				// Echo the data back
				socket.write(new Uint8Array(data));
			});
		});

		// Create three WebSocket clients
		const wsPromises = Array.from({ length: 3 }, async (_, index) => {
			const wsUrl = `ws://${testHost}:${proxyPort}/?host=${testHost}&port=${tcpPort}`;
			const wsClient = new WebSocket(wsUrl);

			const connection = {
				tcpSocket: null as any,
				wsClient,
				receivedData: [] as Buffer[],
			};
			connections.push(connection);

			return new Promise<void>((resolve, reject) => {
				wsClient.on('open', () => {
					// Send test data
					const testMessage = Buffer.from(
						`Test message from client ${index}`
					);
					const messageWithCommand = Buffer.alloc(
						testMessage.length + 1
					);
					messageWithCommand[0] = COMMAND_CHUNK;
					messageWithCommand.set(testMessage, 1);
					wsClient.send(new Uint8Array(messageWithCommand));
				});

				wsClient.on('message', (data: Buffer) => {
					connection.receivedData.push(data);
					// Resolve when we receive the echoed message
					if (
						data.toString() === `Test message from client ${index}`
					) {
						resolve();
					}
				});

				wsClient.on('error', reject);

				// Timeout after 5 seconds
				setTimeout(() => reject(new Error('Timeout')), 5000);
			});
		});

		// Wait for all three connections to complete
		await Promise.all(wsPromises);

		// Verify all connections received their data
		expect(connections).toHaveLength(3);
		connections.forEach((conn, index) => {
			expect(conn.receivedData).toHaveLength(1);
			expect(conn.receivedData[0].toString()).toBe(
				`Test message from client ${index}`
			);
		});

		// Clean up WebSocket connections
		connections.forEach((conn) => {
			conn.wsClient.close();
		});
	});

	it('should handle socket options through WebSocket', async () => {
		let tcpSocket: Socket;
		const setKeepAliveSpy = vi.fn();
		const setNoDelaySpy = vi.fn();

		mockTcpServer.on('connection', (socket: Socket) => {
			tcpSocket = socket;
			// Spy on socket methods
			socket.setKeepAlive = setKeepAliveSpy;
			socket.setNoDelay = setNoDelaySpy;
		});

		const wsUrl = `ws://${testHost}:${proxyPort}/?host=${testHost}&port=${tcpPort}`;
		const wsClient = new WebSocket(wsUrl);

		await new Promise<void>((resolve, reject) => {
			wsClient.on('open', () => {
				// Send socket option commands
				const SOL_SOCKET = 1;
				const SO_KEEPALIVE = 9;
				const IPPROTO_TCP = 6;
				const TCP_NODELAY = 1;

				// Enable keep-alive
				const keepAliveCmd = Buffer.from([
					COMMAND_SET_SOCKETOPT,
					SOL_SOCKET,
					SO_KEEPALIVE,
					1,
				]);
				wsClient.send(new Uint8Array(keepAliveCmd));

				// Enable no-delay
				const noDelayCmd = Buffer.from([
					COMMAND_SET_SOCKETOPT,
					IPPROTO_TCP,
					TCP_NODELAY,
					1,
				]);
				wsClient.send(new Uint8Array(noDelayCmd));

				// Give some time for commands to be processed
				setTimeout(() => {
					resolve();
				}, 100);
			});

			wsClient.on('error', reject);
		});

		// Verify socket options were set
		expect(setKeepAliveSpy).toHaveBeenCalledWith(1);
		expect(setNoDelaySpy).toHaveBeenCalledWith(1);

		wsClient.close();
	});

	it('should handle connection errors gracefully', async () => {
		// Try to connect to a non-existent port
		const wsUrl = `ws://${testHost}:${proxyPort}/?host=${testHost}&port=99999`;
		const wsClient = new WebSocket(wsUrl);

		await new Promise<void>((resolve) => {
			wsClient.on('open', () => {
				// Send some data
				const testMessage = Buffer.from('Test message');
				const messageWithCommand = Buffer.alloc(testMessage.length + 1);
				messageWithCommand[0] = COMMAND_CHUNK;
				messageWithCommand.set(testMessage, 1);
				wsClient.send(new Uint8Array(messageWithCommand));
			});

			wsClient.on('close', (code) => {
				// Should close with error code 3000
				expect(code).toBe(3000);
				resolve();
			});

			wsClient.on('message', (data: Buffer) => {
				// Should receive empty data indicating connection failure
				expect(data.length).toBe(0);
			});
		});
	});

	it('should enhance WebSocket class with socket options support', () => {
		const EnhancedWebSocket = addSocketOptionsSupportToWebSocketClass(
			WebSocket as any
		);
		const mockSend = vi.fn();

		// Create a mock WebSocket instance
		const ws = new EnhancedWebSocket('ws://localhost');
		// Mock the parent send method
		WebSocket.prototype.send = mockSend;

		// Test enhanced send method
		const testData = 'test data';
		ws.send(testData, () => {});

		expect(mockSend).toHaveBeenCalledWith(
			expect.any(String), // Should be the data with COMMAND_CHUNK prepended
			expect.any(Function)
		);

		// Test setSocketOpt method
		ws.setSocketOpt(1, 9, 1); // SOL_SOCKET, SO_KEEPALIVE, enable

		expect(mockSend).toHaveBeenCalledWith(
			expect.any(ArrayBuffer), // Should be the socket option command
			expect.any(Function)
		);
	});
});

// Helper function to find an available port
async function getAvailablePort(startPort = 3000): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(startPort, () => {
			const port = (server.address() as any)?.port;
			server.close(() => {
				resolve(port);
			});
		});
		server.on('error', () => {
			// Try next port
			getAvailablePort(startPort + 1)
				.then(resolve)
				.catch(reject);
		});
	});
}
