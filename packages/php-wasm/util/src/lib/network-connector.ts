/**
 * Unified network connector system for routing network traffic to different handlers
 * based on port, protocol, or custom logic.
 *
 * This enables composable network handling where you can:
 * - Route HTTP/HTTPS to fetch()
 * - Route SMTP to a mock or real SMTP server
 * - Route MySQL to a mock or real MySQL server
 * - Add custom handlers for any port or protocol
 */

/**
 * Information about a connection attempt.
 */
export interface ConnectionInfo {
	/**
	 * The port being connected to
	 */
	port: number;

	/**
	 * The hostname or IP address from the connection request
	 */
	host: string;

	/**
	 * Resolved IP address (if available and different from host)
	 */
	ip?: string;
}

/**
 * A network connection with stream-based I/O.
 * This is the unified connection type used across web and Node.js.
 */
export interface NetworkConnection {
	/**
	 * The host being connected to (e.g., "example.com", "192.168.1.1")
	 */
	host: string;

	/**
	 * The port being connected to (e.g., 80, 443, 3306)
	 */
	port: number;

	/**
	 * Stream of data from the client (PHP) to the server
	 */
	upstream: ReadableStream<Uint8Array>;

	/**
	 * Stream of data from the server back to the client (PHP)
	 */
	downstream: WritableStream<Uint8Array>;
}

/**
 * A network connector handles connections to specific ports or hosts.
 */
export interface NetworkConnector {
	/**
	 * Human-readable name for this connector (e.g., "HTTP Fetch", "SMTP Mock")
	 */
	name: string;

	/**
	 * Determines if this connector should handle a given connection.
	 * Can be:
	 * - A single port number (e.g., 3306)
	 * - An array of port numbers (e.g., [25, 587, 465])
	 * - A predicate function for complex logic
	 */
	matches: number | number[] | ((info: ConnectionInfo) => boolean);

	/**
	 * Handle the network connection.
	 * This method should:
	 * 1. Read data from connection.upstream
	 * 2. Process it according to the protocol
	 * 3. Write responses to connection.downstream
	 *
	 * @param connection The network connection to handle
	 * @returns A promise that resolves when the connection is closed
	 */
	connect(connection: NetworkConnection): Promise<void>;
}

/**
 * Type for a function that finds the appropriate connector for a connection.
 */
export type ConnectToFunction = (
	info: ConnectionInfo
) => NetworkConnector | undefined;

/**
 * Checks if a connector matches the given connection info.
 */
export function connectorMatches(
	connector: NetworkConnector,
	info: ConnectionInfo
): boolean {
	const { matches } = connector;

	if (typeof matches === 'number') {
		return info.port === matches;
	}

	if (Array.isArray(matches)) {
		return matches.includes(info.port);
	}

	if (typeof matches === 'function') {
		return matches(info);
	}

	return false;
}

/**
 * Creates a findConnector function from an array of connectors.
 * Connectors are checked in order, first match wins.
 */
export function createFindConnector(
	connectors: NetworkConnector[]
): ConnectToFunction {
	return (info: ConnectionInfo) => {
		return connectors.find((connector) =>
			connectorMatches(connector, info)
		);
	};
}

/**
 * Helper to create a connector with a simple port matcher.
 */
export function createPortConnector(
	name: string,
	ports: number | number[],
	connect: (connection: NetworkConnection) => Promise<void>
): NetworkConnector {
	return {
		name,
		matches: ports,
		connect,
	};
}

/**
 * Helper to create a connector with custom matching logic.
 */
export function createCustomConnector(
	name: string,
	matcher: (info: ConnectionInfo) => boolean,
	connect: (connection: NetworkConnection) => Promise<void>
): NetworkConnector {
	return {
		name,
		matches: matcher,
		connect,
	};
}
