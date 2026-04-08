/**
 * MySQL Wire Protocol Server
 *
 * Implements enough of the MySQL client/server protocol to let PHP's
 * mysqli extension connect and run queries. The server accepts TCP
 * connections, speaks the MySQL wire protocol, and forwards all SQL
 * queries to a MariaDB WASM bridge (the embedded server compiled to
 * WebAssembly).
 *
 * Protocol reference:
 *   https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_basics.html
 *
 * We implement the minimum viable subset:
 *   - Initial handshake (server greeting + client auth response)
 *   - COM_QUERY (text protocol queries)
 *   - COM_INIT_DB (USE database)
 *   - COM_PING
 *   - COM_QUIT
 *   - COM_SET_OPTION
 *   - COM_FIELD_LIST (stub — WordPress probes this during init)
 *
 * Queries are serialized through Node's single-threaded event loop.
 * Since mariadb-wasm C API calls are synchronous, the event loop
 * blocks during query execution. This is fine for a development
 * tool where queries take < 100ms.
 */

import * as net from 'net';
import type {
	MariaDBBridge,
	ColumnInfo,
	QueryResult,
} from './mariadb-wasm-bridge';
import { MariaDBQueryError } from './mariadb-wasm-bridge';

// -- MySQL protocol constants -----------------------------------------------

/** MySQL command byte constants. */
const COM_QUIT = 0x01;
const COM_INIT_DB = 0x02;
const COM_QUERY = 0x03;
const COM_FIELD_LIST = 0x04;
const COM_PING = 0x0e;
const COM_SET_OPTION = 0x1b;

/** Capability flags the server advertises. */
const CLIENT_LONG_PASSWORD = 1;
const CLIENT_FOUND_ROWS = 1 << 1;
const CLIENT_LONG_FLAG = 1 << 2;
const CLIENT_CONNECT_WITH_DB = 1 << 3;
const CLIENT_PROTOCOL_41 = 1 << 9;
const CLIENT_SECURE_CONNECTION = 1 << 15;
const CLIENT_PLUGIN_AUTH = 1 << 19;

const SERVER_CAPABILITIES =
	CLIENT_LONG_PASSWORD |
	CLIENT_FOUND_ROWS |
	CLIENT_LONG_FLAG |
	CLIENT_CONNECT_WITH_DB |
	CLIENT_PROTOCOL_41 |
	CLIENT_SECURE_CONNECTION |
	CLIENT_PLUGIN_AUTH;

/** Status flags included in OK/EOF packets. */
const SERVER_STATUS_AUTOCOMMIT = 0x0002;

// ---------------------------------------------------------------------------
// Packet-level encoding helpers
// ---------------------------------------------------------------------------

/**
 * Build a MySQL protocol packet: 3-byte length + 1-byte sequence ID +
 * payload. Multiple payloads can be chained into one TCP write.
 */
function buildPacket(sequenceId: number, payload: Buffer): Buffer {
	const header = Buffer.alloc(4);
	header.writeUIntLE(payload.length, 0, 3);
	header[3] = sequenceId & 0xff;
	return Buffer.concat([header, payload]);
}

/** Length-encoded integer (MySQL wire protocol encoding). */
function encodeLenEncInt(value: number): Buffer {
	// Guard against negative values from mysql_affected_rows / mysql_insert_id
	// which return (unsigned long long) -1 in C but become -1 in JS without WASM_BIGINT.
	if (value < 0) {
		return Buffer.from([0]);
	}
	if (value < 251) {
		return Buffer.from([value]);
	} else if (value < 0x10000) {
		const buf = Buffer.alloc(3);
		buf[0] = 0xfc;
		buf.writeUInt16LE(value, 1);
		return buf;
	} else if (value < 0x1000000) {
		const buf = Buffer.alloc(4);
		buf[0] = 0xfd;
		buf.writeUIntLE(value, 1, 3);
		return buf;
	} else {
		const buf = Buffer.alloc(9);
		buf[0] = 0xfe;
		// Write as two 32-bit halves for numbers that fit in a safe integer.
		buf.writeUInt32LE(value & 0xffffffff, 1);
		buf.writeUInt32LE(Math.floor(value / 0x100000000), 5);
		return buf;
	}
}

/** Length-encoded string: length-encoded integer + raw bytes. */
function encodeLenEncString(str: string): Buffer {
	const strBuf = Buffer.from(str, 'utf8');
	return Buffer.concat([encodeLenEncInt(strBuf.length), strBuf]);
}

// ---------------------------------------------------------------------------
// Packet builders
// ---------------------------------------------------------------------------

/**
 * Build the initial handshake packet the server sends when a client
 * connects. This tells the client what protocol version we speak,
 * what capabilities we have, and provides an auth challenge.
 *
 * We use mysql_native_password with a dummy 20-byte challenge because
 * the embedded server has no real authentication — all connections are
 * accepted as root.
 */
function buildHandshakePacket(
	connectionId: number,
	serverVersion: string
): Buffer {
	const parts: Buffer[] = [];

	// Protocol version (always 10 for MySQL 4.1+).
	parts.push(Buffer.from([10]));

	// Server version string, null-terminated.
	parts.push(Buffer.from(serverVersion + '\0', 'utf8'));

	// Connection ID (4 bytes, little-endian).
	const connIdBuf = Buffer.alloc(4);
	connIdBuf.writeUInt32LE(connectionId);
	parts.push(connIdBuf);

	// Auth challenge part 1 (8 bytes). We accept any auth response,
	// so these can be arbitrary non-zero bytes.
	const authChallenge1 = Buffer.from([
		0x7a, 0x39, 0x5e, 0x22, 0x41, 0x6b, 0x3d, 0x17,
	]);
	parts.push(authChallenge1);

	// Filler byte.
	parts.push(Buffer.from([0x00]));

	// Lower 2 bytes of capability flags.
	const capLow = Buffer.alloc(2);
	capLow.writeUInt16LE(SERVER_CAPABILITIES & 0xffff);
	parts.push(capLow);

	// Character set: utf8mb3 general ci = 33.
	parts.push(Buffer.from([33]));

	// Status flags.
	const statusBuf = Buffer.alloc(2);
	statusBuf.writeUInt16LE(SERVER_STATUS_AUTOCOMMIT);
	parts.push(statusBuf);

	// Upper 2 bytes of capability flags.
	const capHigh = Buffer.alloc(2);
	capHigh.writeUInt16LE((SERVER_CAPABILITIES >> 16) & 0xffff);
	parts.push(capHigh);

	// Length of auth-plugin-data (21 for 8 + 13 bytes).
	parts.push(Buffer.from([21]));

	// Reserved 10 bytes (zeros).
	parts.push(Buffer.alloc(10));

	// Auth challenge part 2 (13 bytes, including trailing null).
	const authChallenge2 = Buffer.from([
		0x50, 0x2a, 0x6f, 0x18, 0x55, 0x33, 0x7c, 0x24, 0x6e, 0x43, 0x5b, 0x09,
		0x00,
	]);
	parts.push(authChallenge2);

	// Auth plugin name, null-terminated.
	parts.push(Buffer.from('mysql_native_password\0', 'utf8'));

	return Buffer.concat(parts);
}

/** OK packet for queries that don't return a result set. */
function buildOKPacket(
	affectedRows: number,
	insertId: number,
	warningCount: number
): Buffer {
	const parts: Buffer[] = [];
	// OK header byte.
	parts.push(Buffer.from([0x00]));
	parts.push(encodeLenEncInt(affectedRows));
	parts.push(encodeLenEncInt(insertId));
	// Status flags.
	const status = Buffer.alloc(2);
	status.writeUInt16LE(SERVER_STATUS_AUTOCOMMIT);
	parts.push(status);
	// Warnings.
	const warn = Buffer.alloc(2);
	warn.writeUInt16LE(warningCount);
	parts.push(warn);
	return Buffer.concat(parts);
}

/** Error packet. */
function buildErrorPacket(
	errno: number,
	message: string,
	sqlState = 'HY000'
): Buffer {
	const parts: Buffer[] = [];
	// Error header byte.
	parts.push(Buffer.from([0xff]));
	// Error code (2 bytes).
	const errBuf = Buffer.alloc(2);
	errBuf.writeUInt16LE(errno);
	parts.push(errBuf);
	// SQL state marker '#' + 5 character state.
	parts.push(Buffer.from('#' + sqlState.padEnd(5, '0'), 'utf8'));
	// Human-readable error message.
	parts.push(Buffer.from(message, 'utf8'));
	return Buffer.concat(parts);
}

/** EOF packet — signals the end of a sequence of column definitions or rows. */
function buildEOFPacket(warningCount = 0): Buffer {
	const buf = Buffer.alloc(5);
	buf[0] = 0xfe; // EOF marker
	buf.writeUInt16LE(warningCount, 1);
	buf.writeUInt16LE(SERVER_STATUS_AUTOCOMMIT, 3);
	return buf;
}

/**
 * Column definition packet (COM_QUERY response).
 *
 * This is the Protocol::ColumnDefinition41 packet that describes
 * one column in a result set.
 */
function buildColumnDefinitionPacket(col: ColumnInfo, db: string): Buffer {
	const parts: Buffer[] = [];

	// catalog (always "def").
	parts.push(encodeLenEncString('def'));
	// schema (database name).
	parts.push(encodeLenEncString(db));
	// table (virtual table — we don't track this, use empty string).
	parts.push(encodeLenEncString(''));
	// org_table.
	parts.push(encodeLenEncString(''));
	// name.
	parts.push(encodeLenEncString(col.name));
	// org_name.
	parts.push(encodeLenEncString(col.name));

	// Length of fixed-length fields (always 0x0c).
	parts.push(Buffer.from([0x0c]));

	const fixed = Buffer.alloc(12);
	// Character set: utf8mb3 general ci = 33.
	fixed.writeUInt16LE(33, 0);
	// Column length. Clamp to unsigned 32-bit range — the C API may
	// return negative values when interpreting unsigned fields without
	// WASM_BIGINT.
	fixed.writeUInt32LE(Math.max(0, col.length || 255) >>> 0, 2);
	// Column type.
	fixed[6] = col.type & 0xff;
	// Flags.
	fixed.writeUInt16LE((col.flags || 0) & 0xffff, 7);
	// Decimals.
	fixed[9] = col.decimals || 0;
	// Filler (2 zero bytes) at offset 10 — already zero.
	parts.push(fixed);

	return Buffer.concat(parts);
}

/**
 * Encode a result set row in the text protocol format.
 * Each field is a length-encoded string, or 0xFB for NULL.
 */
function buildRowPacket(row: (string | null)[]): Buffer {
	const parts: Buffer[] = [];
	for (const value of row) {
		if (value === null) {
			parts.push(Buffer.from([0xfb]));
		} else {
			parts.push(encodeLenEncString(value));
		}
	}
	return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

/**
 * Per-connection state machine. Reads packets from the TCP stream,
 * dispatches commands to the MariaDB bridge, and writes response
 * packets back.
 */
class MySQLConnectionHandler {
	private socket: net.Socket;
	private bridge: MariaDBBridge;
	private connectionId: number;
	private currentDb: string;
	private sequenceId = 0;
	private buffer = Buffer.alloc(0);

	constructor(
		socket: net.Socket,
		bridge: MariaDBBridge,
		connectionId: number,
		defaultDb: string
	) {
		this.socket = socket;
		this.bridge = bridge;
		this.connectionId = connectionId;
		this.currentDb = defaultDb;

		socket.on('data', (data) => this.onData(data));
		socket.on('error', () => {
			// Client disconnected ungracefully — nothing to do.
		});

		this.sendHandshake();
	}

	private sendHandshake() {
		const serverVersion = this.bridge.getServerInfo() + '-playground-wasm';
		const payload = buildHandshakePacket(this.connectionId, serverVersion);
		this.socket.write(buildPacket(0, payload));
		this.sequenceId = 1;
	}

	private onData(data: Buffer) {
		this.buffer = Buffer.concat([this.buffer, data]);
		this.processBuffer();
	}

	/**
	 * Process complete packets from the buffer. A packet is complete
	 * when we have at least (payloadLength + 4) bytes.
	 */
	private processBuffer() {
		while (this.buffer.length >= 4) {
			const payloadLength = this.buffer.readUIntLE(0, 3);
			const totalLength = payloadLength + 4;

			if (this.buffer.length < totalLength) {
				// Need more data.
				break;
			}

			const sequenceId = this.buffer[3];
			const payload = this.buffer.subarray(4, totalLength);
			this.buffer = this.buffer.subarray(totalLength);

			this.sequenceId = sequenceId;
			this.handlePacket(payload);
		}
	}

	private handlePacket(payload: Buffer) {
		// During the handshake phase (sequence 1), the first client
		// packet is the Handshake Response. Accept it unconditionally.
		if (this.sequenceId === 1) {
			this.handleHandshakeResponse(payload);
			return;
		}

		if (payload.length === 0) {
			return;
		}

		const command = payload[0];
		const commandData = payload.subarray(1);

		switch (command) {
			case COM_QUIT:
				this.socket.end();
				break;
			case COM_INIT_DB:
				this.handleInitDB(commandData.toString('utf8'));
				break;
			case COM_QUERY:
				this.handleQuery(commandData.toString('utf8'));
				break;
			case COM_PING:
				this.sendOK(0, 0);
				break;
			case COM_FIELD_LIST:
				// WordPress may send COM_FIELD_LIST during init.
				// Respond with an immediate EOF (empty field list).
				this.sendEOF();
				break;
			case COM_SET_OPTION:
				this.sendOK(0, 0);
				break;
			default:
				this.sendError(1047, `Unknown command ${command}`, '08S01');
		}
	}

	/**
	 * Accept any handshake response. The embedded server has no
	 * authentication — we're connecting to ourselves.
	 *
	 * We do inspect the packet for a database name (if the
	 * CLIENT_CONNECT_WITH_DB capability flag is set) and switch
	 * to that database.
	 */
	private handleHandshakeResponse(payload: Buffer) {
		// Parse the Handshake Response 41 packet to extract the
		// database name if provided.
		if (payload.length >= 32) {
			const capFlags = payload.readUInt32LE(0);
			if (capFlags & CLIENT_CONNECT_WITH_DB) {
				// Skip: 4 caps + 4 max_packet + 1 charset + 23 reserved = 32.
				// Then: null-terminated username.
				let offset = 32;
				while (offset < payload.length && payload[offset] !== 0) {
					offset++;
				}
				offset++; // skip null

				// Auth response (length-encoded or fixed based on caps).
				if (capFlags & CLIENT_SECURE_CONNECTION) {
					const authLen = payload[offset];
					offset += 1 + authLen;
				} else {
					while (offset < payload.length && payload[offset] !== 0) {
						offset++;
					}
					offset++;
				}

				// Database name (null-terminated).
				if (offset < payload.length) {
					const dbEnd = payload.indexOf(0, offset);
					if (dbEnd > offset) {
						const db = payload
							.subarray(offset, dbEnd)
							.toString('utf8');
						if (db) {
							this.switchDatabase(db);
						}
					}
				}
			}
		}

		this.sendOK(0, 0);
	}

	private switchDatabase(db: string) {
		try {
			this.bridge.query(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
			this.bridge.query(`USE \`${db}\``);
			this.currentDb = db;
		} catch {
			// Ignore errors — the database may already exist.
		}
	}

	private handleInitDB(db: string) {
		try {
			this.switchDatabase(db);
			this.sendOK(0, 0);
		} catch (e: any) {
			this.sendError(
				e.errno || 1049,
				e.message || `Unknown database '${db}'`
			);
		}
	}

	private handleQuery(sql: string) {
		try {
			const result = this.bridge.query(sql);
			if (result.columns.length === 0) {
				// Non-SELECT query.
				this.sendOK(
					result.affectedRows,
					result.insertId,
					result.warningCount
				);
			} else {
				this.sendResultSet(result);
			}
		} catch (e: any) {
			if (e instanceof MariaDBQueryError) {
				this.sendError(e.errno, e.message);
			} else {
				this.sendError(1105, e.message || 'Unknown error');
			}
		}
	}

	/**
	 * Send a full result set response:
	 *   1. Column count packet
	 *   2. Column definition packets (one per column)
	 *   3. EOF packet
	 *   4. Row data packets
	 *   5. EOF packet
	 */
	private sendResultSet(result: QueryResult) {
		let seq = this.sequenceId + 1;
		const packets: Buffer[] = [];

		// Column count.
		packets.push(
			buildPacket(seq++, encodeLenEncInt(result.columns.length))
		);

		// Column definitions.
		for (const col of result.columns) {
			packets.push(
				buildPacket(
					seq++,
					buildColumnDefinitionPacket(col, this.currentDb)
				)
			);
		}

		// EOF after columns.
		packets.push(buildPacket(seq++, buildEOFPacket(result.warningCount)));

		// Row data.
		for (const row of result.rows) {
			packets.push(buildPacket(seq++, buildRowPacket(row)));
		}

		// EOF after rows.
		packets.push(buildPacket(seq++, buildEOFPacket(result.warningCount)));

		this.socket.write(Buffer.concat(packets));
	}

	private sendOK(affectedRows: number, insertId: number, warningCount = 0) {
		const seq = this.sequenceId + 1;
		this.socket.write(
			buildPacket(
				seq,
				buildOKPacket(affectedRows, insertId, warningCount)
			)
		);
	}

	private sendError(errno: number, message: string, sqlState = 'HY000') {
		const seq = this.sequenceId + 1;
		this.socket.write(
			buildPacket(seq, buildErrorPacket(errno, message, sqlState))
		);
	}

	private sendEOF() {
		const seq = this.sequenceId + 1;
		this.socket.write(buildPacket(seq, buildEOFPacket()));
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MariaDBServerOptions {
	/** The MariaDB WASM bridge to forward queries to. */
	bridge: MariaDBBridge;
	/** TCP port to listen on. 0 = let the OS pick a free port. */
	port?: number;
	/** Host to bind to. Defaults to '127.0.0.1'. */
	host?: string;
	/** Default database name. Defaults to 'wordpress'. */
	defaultDatabase?: string;
}

export interface MariaDBServer {
	/** The TCP port the server is listening on. */
	port: number;
	/** The host the server is bound to. */
	host: string;
	/** Shut down the server and close all connections. */
	close(): Promise<void>;
}

/**
 * Start a MySQL-compatible TCP server backed by MariaDB WASM.
 *
 * PHP's mysqli extension can connect to this server using standard
 * MySQL credentials. The server forwards all queries to the MariaDB
 * embedded server running in WebAssembly.
 */
export function startMySQLProtocolServer(
	options: MariaDBServerOptions
): Promise<MariaDBServer> {
	const {
		bridge,
		port = 0,
		host = '127.0.0.1',
		defaultDatabase = 'wordpress',
	} = options;

	// Ensure the default database exists.
	try {
		bridge.query(`CREATE DATABASE IF NOT EXISTS \`${defaultDatabase}\``);
		bridge.query(`USE \`${defaultDatabase}\``);
	} catch {
		// Ignore — the bridge might not be ready yet, which is fine
		// because each connection also creates the database.
	}

	let nextConnectionId = 1;
	const server = net.createServer((socket) => {
		new MySQLConnectionHandler(
			socket,
			bridge,
			nextConnectionId++,
			defaultDatabase
		);
	});

	return new Promise((resolve, reject) => {
		server.on('error', reject);
		server.listen(port, host, () => {
			const addr = server.address() as net.AddressInfo;
			resolve({
				port: addr.port,
				host: addr.address,
				close() {
					return new Promise<void>((res) => {
						server.close(() => res());
						// Force-close lingering connections.
						server.emit('close');
					});
				},
			});
		});
	});
}
