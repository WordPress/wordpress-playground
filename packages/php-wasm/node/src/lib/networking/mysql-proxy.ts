/**
 * A MySQL wire protocol proxy server that accepts MySQL client
 * connections and delegates query execution to a callback.
 *
 * This allows PHP's mysqlnd to connect and execute queries through
 * the standard MySQL binary protocol, while the actual query
 * execution is handled by an external system (e.g. SQLite via
 * the sqlite-database-integration translator).
 *
 * The proxy implements just enough of the MySQL server protocol
 * to support WordPress's database operations: connecting,
 * querying, pinging, and disconnecting.
 */

import * as net from 'net';
import {
	buildHandshakePacket,
	parseHandshakeResponse,
	buildOkPacket,
	buildErrPacket,
	buildResultSetPackets,
	MySQLPacketParser,
	COM_QUIT,
	COM_INIT_DB,
	COM_QUERY,
	COM_PING,
	MYSQL_TYPE_VAR_STRING,
} from './mysql-protocol';
import type { QueryResult, ColumnDefinition } from './mysql-protocol';
import { findFreePorts } from './utils';
import { debugLog } from './utils';

export type { QueryResult, ColumnDefinition };

function log(...args: any[]) {
	debugLog('[MySQL Proxy]', ...args);
}

/**
 * A function that executes a SQL query and returns the result.
 * The proxy calls this for every COM_QUERY command it receives.
 */
export type QueryHandler = (
	query: string
) => Promise<QueryResult | null>;

export interface MySQLProxyOptions {
	/** Port to listen on. If 0 or not provided, a random free port is used. */
	port?: number;
	/** Host to bind to. Defaults to '127.0.0.1'. */
	host?: string;
	/** The function that handles SQL query execution. */
	queryHandler: QueryHandler;
}

export interface MySQLProxyServer {
	/** The port the server is listening on. */
	port: number;
	/** The host the server is bound to. */
	host: string;
	/** Shuts down the proxy server and closes all connections. */
	close(): Promise<void>;
}

/**
 * Starts a MySQL wire protocol proxy server.
 *
 * The server accepts MySQL client connections, performs the
 * handshake, and forwards query execution to the provided
 * queryHandler callback.
 *
 * Usage:
 * ```ts
 * const proxy = await startMySQLProxy({
 *     queryHandler: async (query) => {
 *         // Execute query against SQLite and return results
 *         return { columns: [...], rows: [...] };
 *     }
 * });
 * // PHP can now connect to 127.0.0.1:proxy.port
 * ```
 */
export async function startMySQLProxy(
	options: MySQLProxyOptions
): Promise<MySQLProxyServer> {
	const host = options.host ?? '127.0.0.1';
	let port = options.port ?? 0;

	if (port === 0) {
		const [freePort] = await findFreePorts(1);
		port = freePort;
	}

	let threadIdCounter = 1;

	const server = net.createServer((socket) => {
		const threadId = threadIdCounter++;
		log(`New connection #${threadId}`);

		const parser = new MySQLPacketParser();
		let handshakeDone = false;

		// Send server greeting
		const { packet: handshakePacket } =
			buildHandshakePacket(threadId);
		socket.write(handshakePacket);

		socket.on('data', async (data) => {
			const packets = parser.feed(data);

			for (const { sequenceId, payload } of packets) {
				try {
					if (!handshakeDone) {
						// This is the client's handshake response
						const { username, database } =
							parseHandshakeResponse(payload);
						log(
							`Auth from user=${username}, db=${database}`
						);
						handshakeDone = true;
						// Accept any credentials
						socket.write(buildOkPacket(sequenceId + 1));
						continue;
					}

					// Command phase
					const commandByte = payload.readUInt8(0);
					const commandPayload = payload.subarray(1);

					switch (commandByte) {
						case COM_QUIT:
							log(`#${threadId} COM_QUIT`);
							socket.end();
							break;

						case COM_PING:
							log(`#${threadId} COM_PING`);
							socket.write(buildOkPacket(sequenceId + 1));
							break;

						case COM_INIT_DB: {
							const dbName =
								commandPayload.toString('utf8');
							log(`#${threadId} COM_INIT_DB: ${dbName}`);
							socket.write(buildOkPacket(sequenceId + 1));
							break;
						}

						case COM_QUERY: {
							const query =
								commandPayload.toString('utf8');
							log(
								`#${threadId} COM_QUERY: ${query.substring(0, 200)}`
							);
							await handleQuery(
								socket,
								sequenceId + 1,
								query,
								options.queryHandler
							);
							break;
						}

						default:
							log(
								`#${threadId} Unknown command: 0x${commandByte.toString(16)}`
							);
							socket.write(
								buildErrPacket(
									sequenceId + 1,
									1047,
									'08S01',
									`Unknown command: 0x${commandByte.toString(16)}`
								)
							);
							break;
					}
				} catch (err: any) {
					log(
						`#${threadId} Error processing packet:`,
						err
					);
					try {
						socket.write(
							buildErrPacket(
								sequenceId + 1,
								1105,
								'HY000',
								err.message || 'Internal proxy error'
							)
						);
					} catch {
						// Socket may already be closed
					}
				}
			}
		});

		socket.on('error', (err) => {
			log(`#${threadId} Socket error:`, err.message);
		});

		socket.on('close', () => {
			log(`#${threadId} Connection closed`);
		});
	});

	return new Promise((resolve, reject) => {
		server.on('error', reject);
		server.listen(port, host, () => {
			const addr = server.address() as net.AddressInfo;
			log(`MySQL proxy listening on ${addr.address}:${addr.port}`);
			resolve({
				port: addr.port,
				host: addr.address,
				close: () =>
					new Promise<void>((res) => {
						server.close(() => res());
						// Force close all existing connections
						server.unref();
					}),
			});
		});
	});
}

/**
 * Handles a COM_QUERY command by executing the query through the
 * query handler and sending the result back over the MySQL protocol.
 */
async function handleQuery(
	socket: net.Socket,
	startSequenceId: number,
	query: string,
	queryHandler: QueryHandler
): Promise<void> {
	try {
		const result = await queryHandler(query);

		if (!result || !result.columns || result.columns.length === 0) {
			// Non-SELECT query (INSERT, UPDATE, DELETE, CREATE, etc.)
			socket.write(
				buildOkPacket(
					startSequenceId,
					result?.affectedRows ?? 0,
					result?.lastInsertId ?? 0,
					result?.warningCount ?? 0
				)
			);
			return;
		}

		// SELECT query - send result set
		const packets = buildResultSetPackets(startSequenceId, result);
		for (const packet of packets) {
			socket.write(packet);
		}
	} catch (err: any) {
		log('Query execution error:', err.message);
		socket.write(
			buildErrPacket(
				startSequenceId,
				1064,
				'42000',
				err.message || 'Query execution failed'
			)
		);
	}
}

/**
 * Creates a QueryResult for a simple single-column, single-row
 * response. Useful for queries like SELECT VERSION() or SELECT 1.
 */
export function singleValueResult(
	columnName: string,
	value: string
): QueryResult {
	return {
		columns: [
			{
				name: columnName,
				type: MYSQL_TYPE_VAR_STRING,
				length: 255,
				flags: 0,
				decimals: 0,
			},
		],
		rows: [[value]],
	};
}
