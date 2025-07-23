#!/usr/bin/env node

import { parseArgs } from 'util';
import { startXDebugBridge, type XDebugBridgeConfig } from './xdebug-bridge';

interface CLIArgs {
	protocol?: 'cdp' | 'dap';
	port?: number;
	host?: string;
	verbose?: boolean;
	help?: boolean;
}

function printHelp(): void {
	// eslint-ignore-next-line
	console.log(`
XDebug Bridge Server CLI

Usage: xdebug-bridge [options]

Options:
  --protocol <protocol>    Protocol to use: cdp, dap (default: cdp)
  --port <port>           Port to listen on (default: 9003)
  --host <host>           Host to bind to (default: localhost)
  --verbose               Enable verbose logging
  --help                  Show this help message

Examples:
  xdebug-bridge                                    # Start with default settings
  xdebug-bridge --port 9000 --verbose            # Custom port with verbose logging
  xdebug-bridge --protocol dap --host 0.0.0.0    # DAP protocol, bind to all interfaces
`);
}

function parseCliArgs(): CLIArgs {
	try {
		const { values } = parseArgs({
			args: process.argv.slice(2),
			options: {
				protocol: {
					type: 'string',
					short: 'p',
				},
				port: {
					type: 'string',
					short: 'P',
				},
				host: {
					type: 'string',
					short: 'h',
				},
				verbose: {
					type: 'boolean',
					short: 'v',
				},
				help: {
					type: 'boolean',
				},
			},
			allowPositionals: false,
		});

		const args: CLIArgs = {};

		if (values.protocol) {
			if (values.protocol !== 'cdp' && values.protocol !== 'dap') {
				throw new Error(
					`Invalid protocol: ${values.protocol}. Must be 'cdp' or 'dap'.`
				);
			}
			args.protocol = values.protocol as 'cdp' | 'dap';
		}

		if (values.port) {
			const port = parseInt(values.port, 10);
			if (isNaN(port) || port < 1 || port > 65535) {
				throw new Error(
					`Invalid port: ${values.port}. Must be a number between 1 and 65535.`
				);
			}
			args.port = port;
		}

		if (values.host) {
			args.host = values.host;
		}

		if (values.verbose) {
			args.verbose = true;
		}

		if (values.help) {
			args.help = true;
		}

		return args;
	} catch (error) {
		console.error(
			`Error parsing arguments: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
		process.exit(1);
	}
}

async function main(): Promise<void> {
	const args = parseCliArgs();

	if (args.help) {
		printHelp();
		return;
	}

	const config: XDebugBridgeConfig = {
		protocol: args.protocol,
		xdebugServerPort: args.port,
		xdebugServerHost: args.host,
		verbose: args.verbose ?? true, // CLI defaults to verbose
	};

	// eslint-ignore-next-line
	console.log('Starting XDebug Bridge Server...');

	const server = startXDebugBridge(config);

	// Handle graceful shutdown
	const shutdown = async (signal: string) => {
		// eslint-ignore-next-line
		console.log(`\nReceived ${signal}, shutting down gracefully...`);
		try {
			await server.stop();
			// eslint-ignore-next-line
			console.log('XDebug Bridge Server stopped.');
			process.exit(0);
		} catch (error) {
			console.error(
				`Error during shutdown: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			process.exit(1);
		}
	};

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));

	// Start the server
	try {
		await server.start();

		const port = server.getPort();
		const host = server.getHost();

		// eslint-ignore-next-line
		console.log(`✅ XDebug Bridge Server is running on ${host}:${port}`);
		// eslint-ignore-next-line
		console.log(`📡 Protocol: ${config.protocol || 'cdp'}`);
		// eslint-ignore-next-line
		console.log('🔍 Waiting for XDebug connections...');
		// eslint-ignore-next-line
		console.log('Press Ctrl+C to stop the server');

		// Set up event listeners for connection activity
		server.on('connection', (socket) => {
			// eslint-ignore-next-line
			console.log(
				`🔗 New XDebug connection established from ${socket.remoteAddress}:${socket.remotePort}`
			);
		});

		server.on('disconnection', (socket) => {
			// eslint-ignore-next-line
			console.log(
				`❌ XDebug connection closed from ${socket.remoteAddress}:${socket.remotePort}`
			);
		});

		server.on('error', (error) => {
			console.error(`❌ Server error: ${error.message}`);
		});

		server.on('socketError', ({ socket, error }) => {
			console.error(
				`❌ Socket error from ${socket.remoteAddress}:${socket.remotePort}: ${error.message}`
			);
		});
	} catch (error) {
		console.error(
			`❌ Failed to start XDebug Bridge Server: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
		process.exit(1);
	}
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error(
			`❌ Unexpected error: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
		process.exit(1);
	});
}
