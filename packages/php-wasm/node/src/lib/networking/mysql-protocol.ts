/**
 * MySQL wire protocol encoding and decoding utilities.
 *
 * Implements the MySQL client/server binary protocol as documented at:
 * https://dev.mysql.com/doc/dev/mysql-server/latest/PAGE_PROTOCOL.html
 *
 * This module provides low-level packet construction and parsing for
 * the subset of the protocol needed to act as a MySQL server proxy
 * that translates queries to SQLite.
 */

// MySQL capability flags
export const CLIENT_LONG_PASSWORD = 0x00000001;
export const CLIENT_FOUND_ROWS = 0x00000002;
export const CLIENT_LONG_FLAG = 0x00000004;
export const CLIENT_CONNECT_WITH_DB = 0x00000008;
export const CLIENT_PROTOCOL_41 = 0x00000200;
export const CLIENT_SECURE_CONNECTION = 0x00008000;
export const CLIENT_PLUGIN_AUTH = 0x00080000;
export const CLIENT_DEPRECATE_EOF = 0x01000000;

// MySQL command bytes
export const COM_QUIT = 0x01;
export const COM_INIT_DB = 0x02;
export const COM_QUERY = 0x03;
export const COM_PING = 0x0e;

// MySQL column types
export const MYSQL_TYPE_DECIMAL = 0x00;
export const MYSQL_TYPE_TINY = 0x01;
export const MYSQL_TYPE_SHORT = 0x02;
export const MYSQL_TYPE_LONG = 0x03;
export const MYSQL_TYPE_FLOAT = 0x04;
export const MYSQL_TYPE_DOUBLE = 0x05;
export const MYSQL_TYPE_NULL = 0x06;
export const MYSQL_TYPE_LONGLONG = 0x08;
export const MYSQL_TYPE_INT24 = 0x09;
export const MYSQL_TYPE_VARCHAR = 0x0f;
export const MYSQL_TYPE_VAR_STRING = 0xfd;
export const MYSQL_TYPE_STRING = 0xfe;
export const MYSQL_TYPE_BLOB = 0xfc;

// Server status flags
export const SERVER_STATUS_AUTOCOMMIT = 0x0002;

export interface QueryResult {
	columns: ColumnDefinition[];
	rows: (string | null)[][];
	affectedRows?: number;
	lastInsertId?: number;
	warningCount?: number;
}

export interface ColumnDefinition {
	name: string;
	type: number;
	/** Max display length in characters */
	length: number;
	flags: number;
	decimals: number;
}

/**
 * Wraps a payload buffer with MySQL packet framing.
 * Each MySQL packet has a 4-byte header: 3 bytes for payload length
 * (little-endian) and 1 byte for sequence ID.
 */
export function wrapPacket(payload: Buffer, sequenceId: number): Buffer {
	const packet = Buffer.alloc(4 + payload.length);
	packet.writeUIntLE(payload.length, 0, 3);
	packet.writeUInt8(sequenceId & 0xff, 3);
	payload.copy(packet, 4);
	return packet;
}

/**
 * Writes a length-encoded integer to a buffer at the given offset.
 * Returns the new offset after writing.
 */
export function writeLengthEncodedInt(
	buf: Buffer,
	offset: number,
	value: number
): number {
	if (value < 251) {
		buf.writeUInt8(value, offset);
		return offset + 1;
	} else if (value < 0x10000) {
		buf.writeUInt8(0xfc, offset);
		buf.writeUInt16LE(value, offset + 1);
		return offset + 3;
	} else if (value < 0x1000000) {
		buf.writeUInt8(0xfd, offset);
		buf.writeUIntLE(value, offset + 1, 3);
		return offset + 4;
	} else {
		buf.writeUInt8(0xfe, offset);
		// For simplicity, write as two 32-bit integers
		buf.writeUInt32LE(value & 0xffffffff, offset + 1);
		buf.writeUInt32LE(Math.floor(value / 0x100000000), offset + 5);
		return offset + 9;
	}
}

/**
 * Creates a Buffer containing a length-encoded integer.
 */
export function encodeLengthEncodedInt(value: number): Buffer {
	const buf = Buffer.alloc(9);
	const len = writeLengthEncodedInt(buf, 0, value) - 0;
	return buf.subarray(0, len);
}

/**
 * Creates a Buffer containing a length-encoded string.
 */
export function encodeLengthEncodedString(str: string): Buffer {
	const strBuf = Buffer.from(str, 'utf8');
	const lenBuf = encodeLengthEncodedInt(strBuf.length);
	return Buffer.concat([lenBuf, strBuf]);
}

/**
 * Reads a length-encoded integer from a buffer at the given offset.
 * Returns [value, newOffset].
 */
export function readLengthEncodedInt(
	buf: Buffer,
	offset: number
): [number, number] {
	const first = buf.readUInt8(offset);
	if (first < 251) {
		return [first, offset + 1];
	} else if (first === 0xfc) {
		return [buf.readUInt16LE(offset + 1), offset + 3];
	} else if (first === 0xfd) {
		return [buf.readUIntLE(offset + 1, 3), offset + 4];
	} else if (first === 0xfe) {
		const low = buf.readUInt32LE(offset + 1);
		const high = buf.readUInt32LE(offset + 5);
		return [high * 0x100000000 + low, offset + 9];
	}
	// 0xfb = NULL, 0xff = ERR
	return [0, offset + 1];
}

/**
 * Reads a null-terminated string from a buffer.
 * Returns [string, newOffset].
 */
export function readNullTerminatedString(
	buf: Buffer,
	offset: number
): [string, number] {
	const end = buf.indexOf(0, offset);
	if (end === -1) {
		return [buf.subarray(offset).toString('utf8'), buf.length];
	}
	return [buf.subarray(offset, end).toString('utf8'), end + 1];
}

/**
 * Builds the initial handshake packet that the MySQL server sends
 * to the client upon connection.
 *
 * Uses HandshakeV10 format with mysql_native_password authentication.
 * Since this is a local proxy that accepts any credentials, the auth
 * data is randomized but not actually verified.
 */
export function buildHandshakePacket(
	threadId: number
): { packet: Buffer; sequenceId: number } {
	const serverVersion = '5.7.99-playground-proxy\0';
	const authPluginName = 'mysql_native_password\0';

	// Generate random auth plugin data (20 bytes total)
	const authData1 = Buffer.alloc(8);
	const authData2 = Buffer.alloc(12);
	for (let i = 0; i < 8; i++) {
		authData1[i] = Math.floor(Math.random() * 256);
	}
	for (let i = 0; i < 12; i++) {
		authData2[i] = Math.floor(Math.random() * 256);
	}

	const capabilities =
		CLIENT_LONG_PASSWORD |
		CLIENT_FOUND_ROWS |
		CLIENT_LONG_FLAG |
		CLIENT_CONNECT_WITH_DB |
		CLIENT_PROTOCOL_41 |
		CLIENT_SECURE_CONNECTION |
		CLIENT_PLUGIN_AUTH;

	const parts: Buffer[] = [];

	// Protocol version
	parts.push(Buffer.from([0x0a]));
	// Server version (null-terminated)
	parts.push(Buffer.from(serverVersion, 'utf8'));
	// Thread ID
	const threadIdBuf = Buffer.alloc(4);
	threadIdBuf.writeUInt32LE(threadId);
	parts.push(threadIdBuf);
	// Auth plugin data part 1 (8 bytes)
	parts.push(authData1);
	// Filler
	parts.push(Buffer.from([0x00]));
	// Capability flags lower 2 bytes
	const capLow = Buffer.alloc(2);
	capLow.writeUInt16LE(capabilities & 0xffff);
	parts.push(capLow);
	// Character set (utf8_general_ci = 33)
	parts.push(Buffer.from([33]));
	// Status flags
	const statusBuf = Buffer.alloc(2);
	statusBuf.writeUInt16LE(SERVER_STATUS_AUTOCOMMIT);
	parts.push(statusBuf);
	// Capability flags upper 2 bytes
	const capHigh = Buffer.alloc(2);
	capHigh.writeUInt16LE((capabilities >> 16) & 0xffff);
	parts.push(capHigh);
	// Auth plugin data length (total = 21 including null terminator)
	parts.push(Buffer.from([21]));
	// Reserved (10 bytes)
	parts.push(Buffer.alloc(10));
	// Auth plugin data part 2 (12 bytes + null terminator)
	parts.push(authData2);
	parts.push(Buffer.from([0x00]));
	// Auth plugin name (null-terminated)
	parts.push(Buffer.from(authPluginName, 'utf8'));

	const payload = Buffer.concat(parts);
	return { packet: wrapPacket(payload, 0), sequenceId: 0 };
}

/**
 * Parses the client's handshake response to extract the username
 * and database name (if provided).
 */
export function parseHandshakeResponse(
	payload: Buffer
): { username: string; database: string } {
	let offset = 0;

	// Capability flags (4 bytes)
	const capabilities = payload.readUInt32LE(offset);
	offset += 4;

	// Max packet size (4 bytes)
	offset += 4;

	// Character set (1 byte)
	offset += 1;

	// Reserved (23 bytes)
	offset += 23;

	// Username (null-terminated)
	const [username, afterUsername] = readNullTerminatedString(
		payload,
		offset
	);
	offset = afterUsername;

	// Auth response
	if (capabilities & CLIENT_SECURE_CONNECTION) {
		const authLen = payload.readUInt8(offset);
		offset += 1 + authLen;
	} else {
		// Null-terminated auth string
		const nullIdx = payload.indexOf(0, offset);
		offset = nullIdx + 1;
	}

	// Database (if CLIENT_CONNECT_WITH_DB)
	let database = '';
	if (capabilities & CLIENT_CONNECT_WITH_DB && offset < payload.length) {
		[database] = readNullTerminatedString(payload, offset);
	}

	return { username, database };
}

/**
 * Builds an OK packet (0x00 header).
 */
export function buildOkPacket(
	sequenceId: number,
	affectedRows = 0,
	lastInsertId = 0,
	warningCount = 0
): Buffer {
	const parts: Buffer[] = [];
	// OK header
	parts.push(Buffer.from([0x00]));
	// Affected rows
	parts.push(encodeLengthEncodedInt(affectedRows));
	// Last insert ID
	parts.push(encodeLengthEncodedInt(lastInsertId));
	// Status flags (SERVER_STATUS_AUTOCOMMIT)
	const statusBuf = Buffer.alloc(2);
	statusBuf.writeUInt16LE(SERVER_STATUS_AUTOCOMMIT);
	parts.push(statusBuf);
	// Warnings
	const warnBuf = Buffer.alloc(2);
	warnBuf.writeUInt16LE(warningCount);
	parts.push(warnBuf);

	return wrapPacket(Buffer.concat(parts), sequenceId);
}

/**
 * Builds an ERR packet (0xFF header).
 */
export function buildErrPacket(
	sequenceId: number,
	errorCode: number,
	sqlState: string,
	message: string
): Buffer {
	const parts: Buffer[] = [];
	// ERR header
	parts.push(Buffer.from([0xff]));
	// Error code
	const errCodeBuf = Buffer.alloc(2);
	errCodeBuf.writeUInt16LE(errorCode);
	parts.push(errCodeBuf);
	// SQL state marker
	parts.push(Buffer.from('#'));
	// SQL state (5 bytes)
	parts.push(Buffer.from(sqlState.padEnd(5, ' ').substring(0, 5)));
	// Error message
	parts.push(Buffer.from(message, 'utf8'));

	return wrapPacket(Buffer.concat(parts), sequenceId);
}

/**
 * Builds an EOF packet (0xFE header).
 */
export function buildEofPacket(
	sequenceId: number,
	warningCount = 0
): Buffer {
	const parts: Buffer[] = [];
	// EOF header
	parts.push(Buffer.from([0xfe]));
	// Warnings
	const warnBuf = Buffer.alloc(2);
	warnBuf.writeUInt16LE(warningCount);
	parts.push(warnBuf);
	// Status flags
	const statusBuf = Buffer.alloc(2);
	statusBuf.writeUInt16LE(SERVER_STATUS_AUTOCOMMIT);
	parts.push(statusBuf);

	return wrapPacket(Buffer.concat(parts), sequenceId);
}

/**
 * Builds a column definition packet for the Protocol::ColumnDefinition41
 * format used in result sets.
 */
export function buildColumnDefinitionPacket(
	sequenceId: number,
	column: ColumnDefinition,
	database = 'wordpress'
): Buffer {
	const parts: Buffer[] = [];
	// catalog (always "def")
	parts.push(encodeLengthEncodedString('def'));
	// schema
	parts.push(encodeLengthEncodedString(database));
	// table (virtual table)
	parts.push(encodeLengthEncodedString(''));
	// org_table
	parts.push(encodeLengthEncodedString(''));
	// name
	parts.push(encodeLengthEncodedString(column.name));
	// org_name
	parts.push(encodeLengthEncodedString(column.name));
	// Length of fixed-length fields (0x0c)
	parts.push(Buffer.from([0x0c]));
	// Character set (utf8_general_ci = 33, binary = 63)
	const charsetBuf = Buffer.alloc(2);
	charsetBuf.writeUInt16LE(33);
	parts.push(charsetBuf);
	// Column length
	const colLenBuf = Buffer.alloc(4);
	colLenBuf.writeUInt32LE(column.length);
	parts.push(colLenBuf);
	// Column type
	parts.push(Buffer.from([column.type]));
	// Flags
	const flagsBuf = Buffer.alloc(2);
	flagsBuf.writeUInt16LE(column.flags);
	parts.push(flagsBuf);
	// Decimals
	parts.push(Buffer.from([column.decimals]));
	// Filler
	parts.push(Buffer.alloc(2));

	return wrapPacket(Buffer.concat(parts), sequenceId);
}

/**
 * Builds a result set row packet. Each cell is encoded as a
 * length-encoded string, or 0xFB for NULL.
 */
export function buildRowDataPacket(
	sequenceId: number,
	row: (string | null)[]
): Buffer {
	const parts: Buffer[] = [];
	for (const value of row) {
		if (value === null) {
			parts.push(Buffer.from([0xfb]));
		} else {
			parts.push(encodeLengthEncodedString(value));
		}
	}
	return wrapPacket(Buffer.concat(parts), sequenceId);
}

/**
 * Builds a complete result set response for a SELECT query.
 * This includes: column count + column definitions + EOF + rows + EOF.
 */
export function buildResultSetPackets(
	startSequenceId: number,
	result: QueryResult
): Buffer[] {
	const packets: Buffer[] = [];
	let seq = startSequenceId;

	// Column count
	packets.push(
		wrapPacket(encodeLengthEncodedInt(result.columns.length), seq++)
	);

	// Column definitions
	for (const column of result.columns) {
		packets.push(buildColumnDefinitionPacket(seq++, column));
	}

	// EOF after columns
	packets.push(buildEofPacket(seq++));

	// Row data
	for (const row of result.rows) {
		packets.push(buildRowDataPacket(seq++, row));
	}

	// EOF after rows
	packets.push(buildEofPacket(seq++));

	return packets;
}

/**
 * Accumulates data from a TCP stream and extracts complete MySQL
 * packets. Handles the case where packets arrive in fragments
 * across multiple TCP segments.
 */
export class MySQLPacketParser {
	private buffer: Buffer = Buffer.alloc(0);

	/**
	 * Feed new data from the TCP stream and return any complete
	 * packets found.
	 */
	feed(data: Buffer): { sequenceId: number; payload: Buffer }[] {
		this.buffer = Buffer.concat([this.buffer, data]);
		const packets: { sequenceId: number; payload: Buffer }[] = [];

		while (this.buffer.length >= 4) {
			const payloadLength = this.buffer.readUIntLE(0, 3);
			const totalLength = 4 + payloadLength;

			if (this.buffer.length < totalLength) {
				// Not enough data for a complete packet yet
				break;
			}

			const sequenceId = this.buffer.readUInt8(3);
			const payload = Buffer.from(
				this.buffer.subarray(4, totalLength)
			);
			packets.push({ sequenceId, payload });
			this.buffer = Buffer.from(this.buffer.subarray(totalLength));
		}

		return packets;
	}
}
