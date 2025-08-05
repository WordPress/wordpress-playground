import { logger } from '@php-wasm/logger';
import { EventEmitter } from 'events';
import net from 'net';

export class DbgpSession extends EventEmitter {
	private server: net.Server;
	private socket: net.Socket | null = null;
	private buffer = '';
	private expectedLength: number | null = null;

	constructor(port = 9003) {
		super();
		this.server = net.createServer();
		this.server.on('connection', (socket) => {
			// Only allow one connection (single-session)
			if (this.socket) {
				socket.destroy();
				return;
			}
			this.socket = socket;
			socket.setEncoding('utf8');
			this.emit('connected');
			socket.on('data', (data: Buffer) => this.onData(data.toString()));
			socket.on('close', () => {
				this.socket = null;
				this.emit('close');
			});
			socket.on('error', (err) => {
				// Forward error events if needed
				this.emit('error', err);
			});
		});
		this.server.listen(port);
	}

	private onData(data: string) {
		logger.debug('\x1b[1;32m[XDebug][received]]\x1b[0m', data);
		this.buffer += data;
		while (true) {
			if (this.expectedLength === null) {
				// Look for the separator for length
				const nullIndex = this.buffer.indexOf('\x00');
				if (nullIndex === -1) {
					// Wait for more data
					break;
				}
				const lengthStr = this.buffer.substring(0, nullIndex);
				const length = parseInt(lengthStr, 10);
				if (isNaN(length)) {
					// Invalid length, reset buffer to be safe
					this.buffer = '';
					break;
				}
				this.expectedLength = length;
				// Remove the length part and null terminator from buffer
				this.buffer = this.buffer.slice(nullIndex + 1);
			}
			if (this.expectedLength !== null) {
				if (this.buffer.length >= this.expectedLength) {
					const xml = this.buffer.substring(0, this.expectedLength);
					this.buffer = this.buffer.slice(this.expectedLength);
					// Remove trailing null of the message if present
					if (this.buffer.startsWith('\x00')) {
						this.buffer = this.buffer.slice(1);
					}
					// Reset expectedLength for next message
					const msg = xml.trim();
					this.expectedLength = null;
					// Emit the raw XML message
					this.emit('message', msg);
					// Continue loop in case multiple messages are in buffer
					continue;
				}
			}
			break;
		}
	}

	sendCommand(command: string) {
		if (!this.socket) return;
		// Commands must end with null terminator
		logger.debug('\x1b[1;32m[XDebug][send]\x1b[0m', command);
		this.socket.write(command + '\x00');
	}

	close() {
		this.server.close();
	}
}
