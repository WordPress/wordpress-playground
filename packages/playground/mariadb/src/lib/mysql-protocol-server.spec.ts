import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as net from 'net';
import { startMySQLProtocolServer } from './mysql-protocol-server';
import type { MariaDBServer } from './mysql-protocol-server';
import type { MariaDBBridge, QueryResult } from './mariadb-wasm-bridge';
import { MariaDBQueryError } from './mariadb-wasm-bridge';

/**
 * Create a minimal mock MariaDBBridge that responds to queries.
 * We don't need the full Emscripten module — just the public API
 * that the protocol server calls.
 */
function createMockBridge(): MariaDBBridge {
	const bridge = {
		getServerInfo: () => '10.11.6-MariaDB-mock',
		query: (sql: string): QueryResult => {
			const upper = sql.trim().toUpperCase();

			if (upper.startsWith('SELECT')) {
				return {
					columns: [
						{
							name: 'answer',
							type: 253,
							length: 255,
							flags: 0,
							decimals: 0,
						},
					],
					rows: [['42']],
					affectedRows: 0,
					insertId: 0,
					warningCount: 0,
				};
			}

			if (sql.includes('FORCE_ERROR')) {
				throw new MariaDBQueryError('test error', 1064, sql);
			}

			return {
				columns: [],
				rows: [],
				affectedRows: 1,
				insertId: 0,
				warningCount: 0,
			};
		},
	} as unknown as MariaDBBridge;
	return bridge;
}

/**
 * Read a complete MySQL packet from a buffer.
 * Returns { payloadLength, sequenceId, payload, totalLength }.
 */
function readPacket(buf: Buffer) {
	if (buf.length < 4) return null;
	const payloadLength = buf.readUIntLE(0, 3);
	const sequenceId = buf[3];
	if (buf.length < 4 + payloadLength) return null;
	const payload = buf.subarray(4, 4 + payloadLength);
	return {
		payloadLength,
		sequenceId,
		payload,
		totalLength: 4 + payloadLength,
	};
}

/**
 * Connect to the server and collect data until we have at least
 * one complete packet, then return it.
 */
function connectAndReadHandshake(
	port: number,
	host: string
): Promise<{ socket: net.Socket; handshake: Buffer }> {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ port, host }, () => {
			// Wait for the handshake packet
			let buf = Buffer.alloc(0);
			socket.on('data', function onData(data) {
				buf = Buffer.concat([buf, data]);
				const pkt = readPacket(buf);
				if (pkt) {
					socket.removeListener('data', onData);
					resolve({ socket, handshake: buf });
				}
			});
		});
		socket.on('error', reject);
	});
}

/**
 * Send a MySQL command packet and read the response.
 */
function sendCommand(
	socket: net.Socket,
	sequenceId: number,
	payload: Buffer
): Promise<Buffer> {
	return new Promise((resolve) => {
		const header = Buffer.alloc(4);
		header.writeUIntLE(payload.length, 0, 3);
		header[3] = sequenceId & 0xff;

		let buf = Buffer.alloc(0);
		function onData(data: Buffer) {
			buf = Buffer.concat([buf, data]);
			// Give it a moment to collect all packets for multi-packet responses
			setTimeout(() => {
				socket.removeListener('data', onData);
				resolve(buf);
			}, 50);
		}
		socket.on('data', onData);
		socket.write(Buffer.concat([header, payload]));
	});
}

/**
 * Build a minimal Handshake Response 41 packet that the server will accept.
 */
function buildHandshakeResponse(database?: string): Buffer {
	const parts: Buffer[] = [];

	// Capability flags (4 bytes)
	let caps = (1 << 9) | (1 << 15); // CLIENT_PROTOCOL_41 | CLIENT_SECURE_CONNECTION
	if (database) {
		caps |= 1 << 3; // CLIENT_CONNECT_WITH_DB
	}
	const capBuf = Buffer.alloc(4);
	capBuf.writeUInt32LE(caps);
	parts.push(capBuf);

	// Max packet size (4 bytes)
	const maxPkt = Buffer.alloc(4);
	maxPkt.writeUInt32LE(0x01000000);
	parts.push(maxPkt);

	// Character set (1 byte)
	parts.push(Buffer.from([33])); // utf8

	// Reserved (23 zero bytes)
	parts.push(Buffer.alloc(23));

	// Username null-terminated
	parts.push(Buffer.from('root\0', 'utf8'));

	// Auth response length + data (CLIENT_SECURE_CONNECTION)
	parts.push(Buffer.from([0])); // 0-length auth

	// Database name if provided
	if (database) {
		parts.push(Buffer.from(database + '\0', 'utf8'));
	}

	return Buffer.concat(parts);
}

describe('MySQL Protocol Server', () => {
	let server: MariaDBServer;
	let bridge: MariaDBBridge;

	beforeEach(async () => {
		bridge = createMockBridge();
		server = await startMySQLProtocolServer({
			bridge,
			port: 0, // OS picks a free port
			defaultDatabase: 'testdb',
		});
	});

	afterEach(async () => {
		await server.close();
	});

	it('listens on the assigned port', () => {
		expect(server.port).toBeGreaterThan(0);
		expect(server.host).toBe('127.0.0.1');
	});

	it('sends a valid handshake greeting on connect', async () => {
		const { socket, handshake } = await connectAndReadHandshake(
			server.port,
			server.host
		);

		const pkt = readPacket(handshake)!;
		expect(pkt.sequenceId).toBe(0);

		// Protocol version byte should be 10
		expect(pkt.payload[0]).toBe(10);

		// Server version string should contain "MariaDB"
		const versionEnd = pkt.payload.indexOf(0, 1);
		const version = pkt.payload.subarray(1, versionEnd).toString('utf8');
		expect(version).toContain('MariaDB');
		expect(version).toContain('playground-wasm');

		socket.destroy();
	});

	it('accepts a handshake response and returns OK', async () => {
		const { socket } = await connectAndReadHandshake(
			server.port,
			server.host
		);

		const response = await sendCommand(socket, 1, buildHandshakeResponse());

		const pkt = readPacket(response)!;
		// OK packet starts with 0x00
		expect(pkt.payload[0]).toBe(0x00);

		socket.destroy();
	});

	it('handles COM_PING with an OK response', async () => {
		const { socket } = await connectAndReadHandshake(
			server.port,
			server.host
		);

		// Complete handshake
		await sendCommand(socket, 1, buildHandshakeResponse());

		// Send COM_PING (command byte 0x0e)
		const pingResponse = await sendCommand(socket, 0, Buffer.from([0x0e]));

		const pkt = readPacket(pingResponse)!;
		expect(pkt.payload[0]).toBe(0x00); // OK

		socket.destroy();
	});

	it('handles COM_QUERY for a non-SELECT and returns OK', async () => {
		const { socket } = await connectAndReadHandshake(
			server.port,
			server.host
		);
		await sendCommand(socket, 1, buildHandshakeResponse());

		// Send COM_QUERY with an INSERT statement
		const queryPayload = Buffer.concat([
			Buffer.from([0x03]), // COM_QUERY
			Buffer.from('INSERT INTO t VALUES (1)', 'utf8'),
		]);
		const response = await sendCommand(socket, 0, queryPayload);

		const pkt = readPacket(response)!;
		// OK packet
		expect(pkt.payload[0]).toBe(0x00);

		socket.destroy();
	});

	it('handles COM_QUERY for a SELECT and returns a result set', async () => {
		const { socket } = await connectAndReadHandshake(
			server.port,
			server.host
		);
		await sendCommand(socket, 1, buildHandshakeResponse());

		const queryPayload = Buffer.concat([
			Buffer.from([0x03]), // COM_QUERY
			Buffer.from('SELECT 42 AS answer', 'utf8'),
		]);
		const response = await sendCommand(socket, 0, queryPayload);

		// The response should contain multiple packets:
		// 1) column count, 2) column def, 3) EOF, 4) row data, 5) EOF
		// First packet after header: column count
		const pkt = readPacket(response)!;
		// Column count should be 1 (length-encoded int)
		expect(pkt.payload[0]).toBe(1);

		// The full response should contain "answer" (column name) and "42" (row value)
		const responseStr = response.toString('utf8');
		expect(responseStr).toContain('answer');
		expect(responseStr).toContain('42');

		socket.destroy();
	});

	it('handles COM_QUERY errors with an error packet', async () => {
		const { socket } = await connectAndReadHandshake(
			server.port,
			server.host
		);
		await sendCommand(socket, 1, buildHandshakeResponse());

		const queryPayload = Buffer.concat([
			Buffer.from([0x03]),
			Buffer.from('FORCE_ERROR', 'utf8'),
		]);
		const response = await sendCommand(socket, 0, queryPayload);

		const pkt = readPacket(response)!;
		// Error packet starts with 0xFF
		expect(pkt.payload[0]).toBe(0xff);

		// Error code at bytes 1-2
		const errno = pkt.payload.readUInt16LE(1);
		expect(errno).toBe(1064);

		socket.destroy();
	});

	it('handles COM_QUIT gracefully', async () => {
		const { socket } = await connectAndReadHandshake(
			server.port,
			server.host
		);
		await sendCommand(socket, 1, buildHandshakeResponse());

		// Send COM_QUIT — the server should close the connection
		const header = Buffer.alloc(4);
		header.writeUIntLE(1, 0, 3);
		header[3] = 0;
		socket.write(Buffer.concat([header, Buffer.from([0x01])]));

		await new Promise<void>((resolve) => {
			socket.on('close', () => resolve());
			// Timeout fallback
			setTimeout(() => {
				socket.destroy();
				resolve();
			}, 500);
		});
	});

	it('close() shuts down the server', async () => {
		await server.close();

		// Trying to connect should fail
		await expect(
			new Promise<void>((resolve, reject) => {
				const s = net.createConnection(
					{ port: server.port, host: server.host },
					() => {
						s.destroy();
						resolve();
					}
				);
				s.on('error', reject);
			})
		).rejects.toThrow();
	});
});
