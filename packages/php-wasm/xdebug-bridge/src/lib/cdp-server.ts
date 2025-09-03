import { logger } from '@php-wasm/logger';
import { EventEmitter } from 'events';
import { type WebSocket, WebSocketServer } from 'ws';

export class CDPServer extends EventEmitter {
	private wss: WebSocketServer;
	private ws: WebSocket | null = null;
	private connected = false;
	private buffer: any[] = [];

	constructor(port = 9229) {
		super();
		this.wss = new WebSocketServer({ port: port });
		this.wss.on('connection', (ws: WebSocket) => {
			// Only one client at a time
			if (this.ws) {
				ws.close();
				return;
			}
			this.ws = ws;
			this.emit('clientConnected');
			ws.on('message', (data) => {
				logger.debug(
					'\x1b[1;32m[CDP][received]\x1b[0m',
					data.toString()
				);
				let message: any;
				try {
					message = JSON.parse(data.toString());
				} catch {
					return;
				}

				if (this.connected) {
					this.emit('message', message);
				} else {
					this.buffer.push(message);
				}
			});
			ws.on('close', () => {
				this.ws = null;
				this.emit('clientDisconnected');
			});
			ws.on('error', (err) => {
				this.emit('error', err);
			});
		});

		// When a new 'message' listener is registered,
		// it replays any buffered messages on the next
		// tick. This ensures that the listener receives
		// all messages that arrived before it was opened.
		// Once replayed, it clears the buffer and marks
		// the connection as established.
		this.on('newListener', (event) => {
			if (event === 'message') {
				process.nextTick(() => {
					for (const message of this.buffer) {
						this.emit('message', message);
					}

					this.buffer = [];

					this.connected = true;
				});
			}
		});
	}

	sendMessage(message: any) {
		if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
			return;
		}
		const json = JSON.stringify(message);
		logger.debug('\x1b[1;32m[CDP][send]\x1b[0m', json);
		this.ws.send(json);
	}

	close() {
		this.wss.close();
	}
}
