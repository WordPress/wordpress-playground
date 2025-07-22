import { createServer, Server, Socket } from 'net';
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

class XDebugBridgeServerImpl extends EventEmitter implements XDebugBridgeServer {
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
			logger: config.logger ?? ((message: string) => {
				if (this.config.verbose) {
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

			this.server.listen(this.config.xdebugServerPort, this.config.xdebugServerHost, () => {
				const address = this.server?.address();
				const port = typeof address === 'object' && address ? address.port : this.config.xdebugServerPort;
				
				this.log(`XDebug bridge server started on ${this.config.xdebugServerHost}:${port}`);
				this.log(`Protocol: ${this.config.protocol}`);
				this.emit('started', { host: this.config.xdebugServerHost, port });
				resolve();
			});
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

		socket.on('data', (data: Buffer) => {
			this.handleXDebugData(socket, data);
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

	private handleXDebugData(socket: Socket, data: Buffer): void {
		const message = data.toString('utf8');
		this.log(`Received XDebug data: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
		
		// Emit the raw data for external processing
		this.emit('xdebugData', { socket, data, message });
		
		// Basic protocol handling based on configured protocol
		if (this.config.protocol === 'cdp') {
			this.handleCDPMessage(socket, message);
		} else if (this.config.protocol === 'dap') {
			this.handleDAPMessage(socket, message);
		}
	}

	private handleCDPMessage(socket: Socket, message: string): void {
		// Basic CDP message handling - this is a placeholder for actual CDP protocol implementation
		try {
			// XDebug typically sends XML, but we might need to convert it to CDP format
			this.log('Processing message for CDP protocol');
			
			// For now, just echo back a simple response to keep the connection alive
			// In a real implementation, this would convert XDebug XML to CDP JSON
		} catch (error) {
			this.log(`Error processing CDP message: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private handleDAPMessage(socket: Socket, message: string): void {
		// Basic DAP message handling - this is a placeholder for actual DAP protocol implementation
		try {
			// XDebug typically sends XML, but we might need to convert it to DAP format
			this.log('Processing message for DAP protocol');
			
			// For now, just echo back a simple response to keep the connection alive
			// In a real implementation, this would convert XDebug XML to DAP JSON
		} catch (error) {
			this.log(`Error processing DAP message: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

/**
 * Starts an XDebug bridge server that can relay debugging sessions.
 * 
 * @param config Configuration options for the XDebug bridge
 * @returns A promise that resolves to an XDebugBridgeServer instance
 */
export function startXDebugBridge(config: XDebugBridgeConfig = {}): XDebugBridgeServer {
	const bridge = new XDebugBridgeServerImpl(config);
	return bridge;
} 