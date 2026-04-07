/**
 * PHP Relay Middleware for Vite dev server.
 *
 * This middleware runs the PHP relay script using PHP WASM in Node.js.
 * It enables the same PHP relay code to run in both development and production.
 */

import type { Connect } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Use dynamic import for PHP WASM to avoid config-time bundling issues
type PHPType = import('@php-wasm/universal').PHP;

let phpInstance: PHPType | null = null;
let phpInitPromise: Promise<PHPType> | null = null;

/**
 * Initialize or get the PHP instance.
 */
async function getPhp(): Promise<PHPType> {
	if (phpInstance) {
		return phpInstance;
	}

	if (phpInitPromise) {
		return phpInitPromise;
	}

	phpInitPromise = (async () => {
		console.log('[PHP Relay] Initializing PHP WASM...');

		// Dynamic imports to avoid config-time bundling issues
		const { PHP } = await import('@php-wasm/universal');
		const { loadNodeRuntime } = await import('@php-wasm/node');

		const php = new PHP(await loadNodeRuntime('8.2'));

		// Create the relay data directory in PHP's virtual filesystem.
		// relay.php picks this up via PLAYGROUND_RELAY_DATA_DIR (set
		// per-request in the env vars below) so we don't have to
		// monkey-patch the script's source any more.
		php.mkdir('/relay-data');
		php.mkdir('/relay-data/sessions');
		php.mkdir('/relay-data/requests');
		php.mkdir('/relay-data/responses');

		// Load the relay PHP script
		const relayPhpPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'../../../../../../public/relay.php'
		);

		let relayPhpContent: string;
		if (existsSync(relayPhpPath)) {
			relayPhpContent = readFileSync(relayPhpPath, 'utf-8');
		} else {
			// Fallback: try relative to cwd
			const altPath = join(
				process.cwd(),
				'packages/playground/website/public/relay.php'
			);
			if (existsSync(altPath)) {
				relayPhpContent = readFileSync(altPath, 'utf-8');
			} else {
				throw new Error(
					`Could not find relay.php at ${relayPhpPath} or ${altPath}`
				);
			}
		}

		php.writeFile('/relay.php', relayPhpContent);

		phpInstance = php;
		console.log('[PHP Relay] PHP WASM initialized');
		return php;
	})();

	return phpInitPromise;
}

/**
 * Convert Node.js request headers to PHP $_SERVER format.
 */
function buildServerVars(
	req: Connect.IncomingMessage,
	path: string
): Record<string, string> {
	const headers = req.headers;
	// Pull QUERY_STRING out of the URL so PHP's $_GET superglobal
	// gets populated. The relay's /status endpoint reads ?gid=… from
	// it; without this, the heartbeat would silently no-op.
	const url = req.url || '/';
	const queryIdx = url.indexOf('?');
	const queryString = queryIdx >= 0 ? url.slice(queryIdx + 1) : '';
	const server: Record<string, string> = {
		REQUEST_METHOD: req.method || 'GET',
		REQUEST_URI: url,
		SCRIPT_NAME: '/relay.php',
		SCRIPT_FILENAME: '/relay.php',
		PHP_SELF: '/relay.php',
		SERVER_NAME: (headers.host as string)?.split(':')[0] || 'localhost',
		SERVER_PORT: (headers.host as string)?.split(':')[1] || '80',
		HTTP_HOST: headers.host as string || 'localhost',
		DOCUMENT_ROOT: '/',
		QUERY_STRING: queryString,
		// Tell relay.php where to put session/request files inside
		// the PHP-WASM virtual filesystem. This replaces the old
		// string-replace hack that hard-coded the data dir.
		PLAYGROUND_RELAY_DATA_DIR: '/relay-data',
	};

	// Add HTTP headers
	for (const [key, value] of Object.entries(headers)) {
		if (typeof value === 'string') {
			const serverKey = 'HTTP_' + key.toUpperCase().replace(/-/g, '_');
			server[serverKey] = value;
		}
	}

	// Content-Type and Content-Length
	if (headers['content-type']) {
		server['CONTENT_TYPE'] = headers['content-type'] as string;
	}
	if (headers['content-length']) {
		server['CONTENT_LENGTH'] = headers['content-length'] as string;
	}

	// HTTPS detection
	if (headers['x-forwarded-proto'] === 'https') {
		server['HTTPS'] = 'on';
		server['HTTP_X_FORWARDED_PROTO'] = 'https';
	}

	return server;
}

/**
 * Read the request body as a string.
 */
function readRequestBody(req: Connect.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on('end', () => resolve(body));
		req.on('error', reject);
	});
}

export interface PhpRelayMiddlewareOptions {
	/** Base path for the website (e.g., '/website-server/' in dev mode) */
	basePath?: string;
}

/**
 * Create a Vite/Connect middleware that runs the PHP relay using PHP WASM.
 */
export function createPhpRelayMiddleware(
	options: PhpRelayMiddlewareOptions = {}
): Connect.NextHandleFunction {
	return async (req, res, next) => {
		const url = req.url || '';

		// Only handle /relay/ requests
		if (!url.startsWith('/relay/')) {
			return next();
		}

		// Handle CORS preflight
		if (req.method === 'OPTIONS') {
			const httpRes = res as unknown as import('http').ServerResponse;
			httpRes.statusCode = 204;
			httpRes.setHeader('Access-Control-Allow-Origin', '*');
			httpRes.setHeader(
				'Access-Control-Allow-Methods',
				'GET, POST, PUT, DELETE, OPTIONS'
			);
			httpRes.setHeader(
				'Access-Control-Allow-Headers',
				'Content-Type, X-Request-Id'
			);
			httpRes.setHeader('Access-Control-Max-Age', '86400');
			httpRes.end();
			return;
		}

		try {
			const php = await getPhp();

			// Read request body
			const body = await readRequestBody(req);

			// Build server variables
			const serverVars = buildServerVars(req, url);

			// Run the PHP script
			const result = await php.run({
				scriptPath: '/relay.php',
				env: serverVars,
				body: body ? new TextEncoder().encode(body) : undefined,
			});

			const httpRes = res as unknown as import('http').ServerResponse;

			// Use the PHPResponse's httpStatusCode and headers
			httpRes.statusCode = result.httpStatusCode;

			// Set headers from PHP response
			for (const [name, values] of Object.entries(result.headers)) {
				if (name.toLowerCase() === 'transfer-encoding') {
					continue;
				}
				// Join multiple header values
				const value = Array.isArray(values) ? values.join(', ') : values;
				httpRes.setHeader(name, value);
			}

			// Ensure CORS header is set
			httpRes.setHeader('Access-Control-Allow-Origin', '*');

			// Send the response body
			httpRes.end(Buffer.from(result.bytes));
		} catch (error) {
			console.error('[PHP Relay] Error:', error);
			const httpRes = res as unknown as import('http').ServerResponse;
			httpRes.statusCode = 500;
			httpRes.setHeader('Content-Type', 'application/json');
			httpRes.setHeader('Access-Control-Allow-Origin', '*');
			httpRes.end(JSON.stringify({ error: 'Internal server error' }));
		}
	};
}
