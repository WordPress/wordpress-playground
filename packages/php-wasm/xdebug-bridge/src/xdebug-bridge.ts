import { createServer, type Server, type Socket } from 'net';
import { EventEmitter } from 'events';

export interface XDebugBridgeConfig {
	/**
	 * The protocol to use for the bridge communication.
	 * @default "cdp"
	 */
	protocol?: 'cdp' | 'dap';

	/**
	 * The port where XDebug server will listen for connections.
	 * @default 9003
	 */
	xdebugServerPort?: number;

	/**
	 * The host where XDebug server will bind to.
	 * @default "localhost"
	 */
	xdebugServerHost?: string;

	/**
	 * Whether to enable verbose logging.
	 * @default false
	 */
	verbose?: boolean;

	/**
	 * Custom logger function. If not provided and verbose is true, console.log will be used.
	 */
	logger?: (message: string) => void;
}

export interface XDebugBridgeServer extends EventEmitter {
	/**
	 * Start the XDebug bridge server.
	 */
	start(): Promise<void>;

	/**
	 * Stop the XDebug bridge server.
	 */
	stop(): Promise<void>;

	/**
	 * Get the actual port the server is listening on.
	 */
	getPort(): number | null;

	/**
	 * Get the host the server is listening on.
	 */
	getHost(): string;

	/**
	 * Check if the server is currently running.
	 */
	isRunning(): boolean;
}

class XDebugBridgeServerImpl
	extends EventEmitter
	implements XDebugBridgeServer
{
	private server: Server | null = null;
	private config: Required<XDebugBridgeConfig>;
	private connectedClients = new Set<Socket>();

	constructor(config: XDebugBridgeConfig = {}) {
		super();

		this.config = {
			protocol: config.protocol ?? 'cdp',
			xdebugServerPort: config.xdebugServerPort ?? 9003,
			xdebugServerHost: config.xdebugServerHost ?? 'localhost',
			verbose: config.verbose ?? false,
			logger:
				config.logger ??
				((message: string) => {
					if (this.config.verbose) {
						// @ts-ignore
						console.log(`[XDebug Bridge] ${message}`);
					}
				}),
		};
	}

	private log(message: string): void {
		this.config.logger(message);
	}

	async start(): Promise<void> {
		if (this.server) {
			throw new Error('XDebug bridge server is already running');
		}

		return new Promise((resolve, reject) => {
			this.server = createServer();

			this.server.on('connection', (socket: Socket) => {
				this.handleConnection(socket);
			});

			this.server.on('error', (error: Error) => {
				this.log(`Server error: ${error.message}`);
				this.emit('error', error);
				reject(error);
			});

			this.server.listen(
				this.config.xdebugServerPort,
				this.config.xdebugServerHost,
				() => {
					const address = this.server?.address();
					const port =
						typeof address === 'object' && address
							? address.port
							: this.config.xdebugServerPort;

					this.log(
						`XDebug bridge server started on ${this.config.xdebugServerHost}:${port}`
					);
					this.log(`Protocol: ${this.config.protocol}`);
					this.emit('started', {
						host: this.config.xdebugServerHost,
						port,
					});
					resolve();
				}
			);
		});
	}

	async stop(): Promise<void> {
		if (!this.server) {
			return;
		}

		return new Promise((resolve) => {
			// Close all client connections
			for (const client of this.connectedClients) {
				client.destroy();
			}
			this.connectedClients.clear();

			this.server!.close(() => {
				this.log('XDebug bridge server stopped');
				this.emit('stopped');
				this.server = null;
				resolve();
			});
		});
	}

	getPort(): number | null {
		if (!this.server) return null;
		const address = this.server.address();
		return typeof address === 'object' && address ? address.port : null;
	}

	getHost(): string {
		return this.config.xdebugServerHost;
	}

	isRunning(): boolean {
		return this.server !== null && this.server.listening;
	}

	private handleConnection(socket: Socket): void {
		const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
		this.log(`New XDebug connection from ${clientAddress}`);

		this.connectedClients.add(socket);
		this.emit('connection', socket);

		socket.on('data', () => {
			// TODO: Handle XDebug data
		});

		socket.on('close', () => {
			this.log(`XDebug connection closed from ${clientAddress}`);
			this.connectedClients.delete(socket);
			this.emit('disconnection', socket);
		});

		socket.on('error', (error: Error) => {
			this.log(`Socket error from ${clientAddress}: ${error.message}`);
			this.connectedClients.delete(socket);
			this.emit('socketError', { socket, error });
		});
	}
}

/**
 * Starts an XDebug bridge server that can relay debugging sessions.
 *
 * @param config Configuration options for the XDebug bridge
 * @returns A promise that resolves to an XDebugBridgeServer instance
 */
export function startXDebugBridge(
	config: XDebugBridgeConfig = {}
): XDebugBridgeServer {
	const bridge = new XDebugBridgeServerImpl(config);
	return bridge;
}
