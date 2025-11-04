/**
 * Unified MySQL mock connector.
 *
 * Simulates a MySQL server on port 3306.
 * Works in both browser and Node.js environments.
 */

export interface MysqlConnectorOptions {
	serverVersion?: string;
	onQuery?: (query: string) => void;
	debug?: boolean;
}

export function createMysqlConnector(options: MysqlConnectorOptions = {}) {
	const serverVersion = options.serverVersion || '8.0.0-playground-mock';
	const debug = options.debug || false;

	return {
		name: 'MySQL Mock',
		matches: 3306,
		connect: async (connection: {
			host: string;
			port: number;
			upstream: ReadableStream<Uint8Array>;
			downstream: WritableStream<Uint8Array>;
		}) => {
			const log = debug
				? (msg: string) =>
						console.log(
							`[MySQL ${connection.host}:${connection.port}] ${msg}`
						)
				: () => {};

			log('Connection established');

			const reader = connection.upstream.getReader();
			const writer = connection.downstream.getWriter();

			try {
				// Send initial handshake packet
				const handshake = createHandshakePacket(serverVersion);
				await writer.write(handshake);
				log('Sent handshake packet');

				// Read authentication response
				const authResponse = await readPacket(reader);
				if (authResponse) {
					log('Received authentication response');

					// Send OK packet to accept authentication
					const okPacket = createOkPacket();
					await writer.write(okPacket);
					log('Authentication successful');
				}

				// Handle queries
				while (true) {
					const packet = await readPacket(reader);
					if (!packet) {
						log('Connection closed by client');
						break;
					}

					// Parse command type (first byte after header)
					const commandType = packet[4];

					switch (commandType) {
						case 0x01: // COM_QUIT
							log('Client requested disconnect');
							await writer.close();
							return;

						case 0x03: // COM_QUERY
							const query = new TextDecoder().decode(
								packet.slice(5)
							);
							log(`Query: ${query}`);

							if (options.onQuery) {
								options.onQuery(query);
							}

							// Send mock result set
							const resultSet = createMockResultSet(query);
							await writer.write(resultSet);
							break;

						case 0x0e: // COM_PING
							log('Ping received');
							const pingOk = createOkPacket();
							await writer.write(pingOk);
							break;

						case 0x16: // COM_STMT_PREPARE
							log('Prepare statement request');
							const prepareOk = createPrepareOkPacket();
							await writer.write(prepareOk);
							break;

						case 0x17: // COM_STMT_EXECUTE
							log('Execute statement request');
							const execResult = createMockResultSet('SELECT 1');
							await writer.write(execResult);
							break;

						default:
							log(
								`Unknown command type: 0x${commandType.toString(
									16
								)}`
							);
							// Send OK anyway to keep connection alive
							const unknownOk = createOkPacket();
							await writer.write(unknownOk);
							break;
					}
				}
			} catch (error) {
				log(`Error: ${error}`);
			} finally {
				try {
					await writer.close();
				} catch {
					// Already closed
				}
				log('Connection terminated');
			}
		},
	};
}

/**
 * Read a MySQL packet from the stream
 */
async function readPacket(
	reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<Uint8Array | null> {
	// Read packet header (4 bytes: 3 bytes length + 1 byte sequence)
	let header = new Uint8Array(0);
	while (header.length < 4) {
		const { done, value } = await reader.read();
		if (done) return null;
		header = concatUint8Arrays([header, value]);
	}

	// Parse packet length
	const length = header[0] | (header[1] << 8) | (header[2] << 16);

	// Read packet body
	let body = header.slice(4);
	while (body.length < length) {
		const { done, value } = await reader.read();
		if (done) return null;
		body = concatUint8Arrays([body, value]);
	}

	// Return header + body (full packet)
	return concatUint8Arrays([header.slice(0, 4), body.slice(0, length)]);
}

/**
 * Create MySQL handshake packet (Protocol version 10)
 */
function createHandshakePacket(serverVersion: string): Uint8Array {
	const parts: number[] = [];

	// Protocol version (10)
	parts.push(0x0a);

	// Server version (null-terminated)
	const versionBytes = new TextEncoder().encode(serverVersion);
	parts.push(...versionBytes, 0x00);

	// Connection ID (4 bytes)
	parts.push(0x01, 0x00, 0x00, 0x00);

	// Auth plugin data part 1 (8 bytes)
	parts.push(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);

	// Filler (1 byte)
	parts.push(0x00);

	// Capability flags (2 bytes) - lower 16 bits
	parts.push(0xff, 0xf7);

	// Character set (1 byte) - utf8_general_ci
	parts.push(0x21);

	// Status flags (2 bytes)
	parts.push(0x02, 0x00);

	// Capability flags (2 bytes) - upper 16 bits
	parts.push(0xff, 0x81);

	// Auth plugin data length (1 byte)
	parts.push(0x15);

	// Reserved (10 bytes)
	parts.push(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);

	// Auth plugin data part 2 (12 bytes + null terminator)
	parts.push(
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00
	);

	// Auth plugin name (null-terminated) - mysql_native_password
	const pluginName = new TextEncoder().encode('mysql_native_password');
	parts.push(...pluginName, 0x00);

	const body = new Uint8Array(parts);
	return addPacketHeader(body, 0);
}

/**
 * Create MySQL OK packet
 */
function createOkPacket(): Uint8Array {
	const parts: number[] = [];

	// OK header
	parts.push(0x00);

	// Affected rows (length-encoded integer - 0)
	parts.push(0x00);

	// Last insert ID (length-encoded integer - 0)
	parts.push(0x00);

	// Status flags (2 bytes)
	parts.push(0x02, 0x00);

	// Warnings (2 bytes)
	parts.push(0x00, 0x00);

	const body = new Uint8Array(parts);
	return addPacketHeader(body, 1);
}

/**
 * Create a mock result set for a query
 */
function createMockResultSet(query: string): Uint8Array {
	// For simplicity, always return a single row with value 1
	const packets: Uint8Array[] = [];

	// Column count packet
	packets.push(addPacketHeader(new Uint8Array([0x01]), 1));

	// Column definition packet
	const colDef: number[] = [];
	// catalog
	colDef.push(0x03, 0x64, 0x65, 0x66); // "def"
	// schema (empty)
	colDef.push(0x00);
	// table (empty)
	colDef.push(0x00);
	// org_table (empty)
	colDef.push(0x00);
	// name
	colDef.push(0x01, 0x31); // "1"
	// org_name
	colDef.push(0x00);
	// filler
	colDef.push(0x0c);
	// character set (2 bytes) - binary
	colDef.push(0x3f, 0x00);
	// column length (4 bytes)
	colDef.push(0x01, 0x00, 0x00, 0x00);
	// type (LONG)
	colDef.push(0x08);
	// flags (2 bytes)
	colDef.push(0x01, 0x00);
	// decimals
	colDef.push(0x00);
	// filler (2 bytes)
	colDef.push(0x00, 0x00);

	packets.push(addPacketHeader(new Uint8Array(colDef), 2));

	// EOF packet (or OK packet in newer protocol)
	packets.push(
		addPacketHeader(new Uint8Array([0xfe, 0x00, 0x00, 0x02, 0x00]), 3)
	);

	// Row data packet
	const rowData = new Uint8Array([0x01, 0x31]); // "1"
	packets.push(addPacketHeader(rowData, 4));

	// EOF packet
	packets.push(
		addPacketHeader(new Uint8Array([0xfe, 0x00, 0x00, 0x02, 0x00]), 5)
	);

	return concatUint8Arrays(packets);
}

/**
 * Create prepare OK packet for prepared statements
 */
function createPrepareOkPacket(): Uint8Array {
	const parts: number[] = [];

	// OK header for prepared statement
	parts.push(0x00);

	// Statement ID (4 bytes)
	parts.push(0x01, 0x00, 0x00, 0x00);

	// Number of columns (2 bytes)
	parts.push(0x01, 0x00);

	// Number of parameters (2 bytes)
	parts.push(0x00, 0x00);

	// Filler (1 byte)
	parts.push(0x00);

	// Warning count (2 bytes)
	parts.push(0x00, 0x00);

	const body = new Uint8Array(parts);
	return addPacketHeader(body, 1);
}

/**
 * Add MySQL packet header (length + sequence number)
 */
function addPacketHeader(body: Uint8Array, sequenceId: number): Uint8Array {
	const length = body.length;
	const header = new Uint8Array([
		length & 0xff,
		(length >> 8) & 0xff,
		(length >> 16) & 0xff,
		sequenceId & 0xff,
	]);
	return concatUint8Arrays([header, body]);
}

/**
 * Concatenate Uint8Arrays
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}
