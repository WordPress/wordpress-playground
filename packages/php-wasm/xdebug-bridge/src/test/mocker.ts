import { vi } from 'vitest';

vi.mock('ws', async () => {
	const { EventEmitter } = await import('events');

	class WebSocket extends EventEmitter {
		readyState = 1;
		OPEN = 1;
		send = vi.fn();
		close = vi.fn();
	}

	class WebSocketServer extends EventEmitter {
		close = vi.fn();
	}

	return {
		WebSocketServer,
		WebSocket,
	};
});

vi.mock('net', async () => {
	const { EventEmitter } = await import('events');

	class Socket extends EventEmitter {
		setEncoding = vi.fn();
		write = vi.fn();
		destroy = vi.fn();
	}

	class Server extends EventEmitter {
		listen = vi.fn();
		close = vi.fn();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		onConnectionHandler: Function | undefined;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		override on = vi.fn((event: string, handler: Function) => {
			if (event === 'connection') this.onConnectionHandler = handler;

			return this;
		});
	}

	return {
		default: {
			createServer: vi.fn(() => new Server()),
			Socket,
			Server,
		},
	};
});

vi.mock(import('fs'), async (original) => {
	const fs = await original();
	return {
		...fs,
		readdirSync: vi.fn().mockReturnValue(['foo.js', 'bar.md', 'baz.php']),
		lstatSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
		readFileSync: vi.fn().mockReturnValue('<?php echo "Hello World";'),
	};
});

vi.mock(import('path'), async (original) => {
	const path = await original();
	return {
		...path,
		join: vi.fn((...args: string[]) => args.join('/')),
	};
});
