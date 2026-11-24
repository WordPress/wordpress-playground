import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from 'node:http';
import { expect, test } from '@playwright/test';
import { joinPaths } from '@php-wasm/util';

/**
 * Stable contract: URL mode follows allowed redirects, but rejects an off-list
 * redirect before the destination receives a request.
 * Plausible regression: automatic cURL redirects are re-enabled for URL mode.
 * Independent path: these tests call the real endpoint and record requests
 * received by a separate in-process HTTP server.
 */

test.describe.configure({ mode: 'serial' });
test.skip(
	({ browserName }) => browserName !== 'chromium',
	'This server-side endpoint behavior only needs one Playwright project.'
);

const pluginProxyDocumentRoot = joinPaths(__dirname, '../../public');
const pluginProxyRouter = joinPaths(__dirname, 'plugin-proxy-test-router.php');

let requestDestinations: string[] = [];
let pluginProxyUrl = '';
let upstreamServer: Server | undefined;
let pluginProxyServer: PhpServer | undefined;

test.beforeAll(async () => {
	upstreamServer = createServer(routeUpstreamRequest);
	const upstreamPort = await listenOnAvailablePort(upstreamServer);

	const pluginProxyPort = await getAvailablePort();
	pluginProxyUrl = `http://127.0.0.1:${pluginProxyPort}/plugin-proxy.php`;
	pluginProxyServer = startPhpServer(
		[
			'-d',
			'display_errors=0',
			'-S',
			`127.0.0.1:${pluginProxyPort}`,
			'-t',
			pluginProxyDocumentRoot,
			pluginProxyRouter,
		],
		{
			http_proxy: `http://127.0.0.1:${upstreamPort}`,
			HTTP_PROXY: '',
			https_proxy: '',
			HTTPS_PROXY: '',
			all_proxy: '',
			ALL_PROXY: '',
			no_proxy: '',
			NO_PROXY: '',
		}
	);
	await waitForPhpServer(pluginProxyServer, pluginProxyUrl);
});

test.beforeEach(async () => {
	requestDestinations = [];
});

test.afterAll(async () => {
	await Promise.all([
		stopPhpServer(pluginProxyServer),
		stopHttpServer(upstreamServer),
	]);
});

test('rejects a direct off-allowlist URL without fetching it', async ({
	request,
}) => {
	const response = await request.get(
		urlForTarget('http://example.com/direct')
	);

	expect(response.status()).toBe(403);
	expect(await response.text()).toBe(
		'Error: The specified URL is not allowed.'
	);
	expect(requestDestinations).toEqual([]);
});

/**
 * Stable contract: Forward an upstream Content-Type when it is allowed. When it
 * is filtered out, send the configured default Content-Type instead.
 *
 * Plausible regressions: A filtered header could prevent the default from being
 * sent, or the default could overwrite an allowed upstream header.
 *
 * Independent code path: The PHP fixture calls the production header helper.
 * The test checks the Content-Type on the HTTP response returned to the client.
 */
test('uses a default header only when the matching upstream header is filtered', async ({
	request,
}) => {
	const filteredResponse = await request.get(
		urlForDefaultResponseHeaders({ allowContentType: false })
	);

	expect(filteredResponse.status()).toBe(200);
	expect(filteredResponse.headers()['content-type']).toBe('application/zip');
	expect(await filteredResponse.text()).toBe('body');

	const allowedResponse = await request.get(
		urlForDefaultResponseHeaders({ allowContentType: true })
	);

	expect(allowedResponse.status()).toBe(200);
	expect(allowedResponse.headers()['content-type']).toBe(
		'application/octet-stream'
	);
	expect(await allowedResponse.text()).toBe('body');
});

test('follows absolute and relative redirects within the allowlist', async ({
	request,
}) => {
	const response = await request.get(
		urlForTarget('http://wordpress.org/redirect-chain?original=query')
	);

	expect(response.status()).toBe(200);
	expect(await response.json()).toEqual({
		host: 'w.org',
		method: 'GET',
		body: '',
		query: { source: 'relative', token: 'kept' },
	});
	expect(requestDestinations).toEqual([
		'wordpress.org /redirect-chain',
		'w.org /redirect-relative',
		'w.org /final',
	]);
});

test('rejects an off-allowlist redirect before fetching it', async ({
	request,
}) => {
	const response = await request.fetch(
		urlForTarget('http://wordpress.org/redirect-to-blocked'),
		{ method: 'PATCH', data: 'payload=blocked' }
	);

	expect(response.status()).toBe(403);
	expect(requestDestinations).toEqual(['wordpress.org /redirect-to-blocked']);
});

test('preserves cURL POST redirect behavior', async ({ request }) => {
	const response302 = await request.post(
		urlForTarget('http://wordpress.org/redirect-302'),
		{
			data: 'payload=discarded',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		}
	);
	expect(await response302.json()).toEqual({
		host: 'wordpress.org',
		method: 'GET',
		body: '',
		query: {},
	});

	const response307 = await request.post(
		urlForTarget('http://wordpress.org/redirect-307'),
		{
			data: 'payload=preserved',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		}
	);
	expect(await response307.json()).toEqual({
		host: 'wordpress.org',
		method: 'POST',
		body: 'payload=preserved',
		query: {},
	});
});

test('forwards other methods with cURL redirect behavior', async ({
	request,
}) => {
	const response302 = await request.fetch(
		urlForTarget('http://wordpress.org/redirect-302'),
		{ method: 'PATCH', data: 'payload=patch' }
	);
	expect(await response302.json()).toEqual({
		host: 'wordpress.org',
		method: 'PATCH',
		body: 'payload=patch',
		query: {},
	});

	const response303 = await request.fetch(
		urlForTarget('http://wordpress.org/redirect-303'),
		{ method: 'PUT', data: 'payload=discarded' }
	);
	expect(await response303.json()).toEqual({
		host: 'wordpress.org',
		method: 'GET',
		body: '',
		query: {},
	});

	const response307 = await request.fetch(
		urlForTarget('http://wordpress.org/redirect-307'),
		{ method: 'DELETE', data: 'payload=delete' }
	);
	expect(await response307.json()).toEqual({
		host: 'wordpress.org',
		method: 'DELETE',
		body: 'payload=delete',
		query: {},
	});
});

test('bounds redirect loops', async ({ request }) => {
	const response = await request.get(
		urlForTarget('http://wordpress.org/loop')
	);

	expect(response.status()).toBe(400);
	expect(await response.json()).toEqual({ error: 'Too many redirects' });
	expect(requestDestinations).toHaveLength(31);
});

function urlForTarget(targetUrl: string) {
	const url = new URL(pluginProxyUrl);
	url.searchParams.set('url', targetUrl);
	return url.href;
}

function urlForDefaultResponseHeaders({
	allowContentType,
}: {
	allowContentType: boolean;
}) {
	const url = new URL('/__test-default-response-headers', pluginProxyUrl);
	if (allowContentType) {
		url.searchParams.set('allow-content-type', '1');
	}
	return url.href;
}

/**
 * This in-process router is the plugin proxy's fake upstream service. The PHP
 * cURL client reaches it through the http_proxy environment variable, allowing
 * the tests to control redirects and echoed requests without external network
 * calls. Running it in this process also lets each destination be recorded
 * directly in requestDestinations for assertions.
 */
function routeUpstreamRequest(
	request: IncomingMessage,
	response: ServerResponse
) {
	handleUpstreamRequest(request, response).catch((error) => {
		if (!response.headersSent) {
			response.statusCode = 500;
		}
		response.end(error instanceof Error ? error.message : String(error));
	});
}

async function handleUpstreamRequest(
	request: IncomingMessage,
	response: ServerResponse
) {
	const requestUrl = new URL(
		request.url || '/',
		`http://${request.headers.host || '127.0.0.1'}`
	);
	const host = requestUrl.hostname;
	const path = requestUrl.pathname;
	const body = await readRequestBody(request);
	requestDestinations.push(`${host} ${path}`);

	switch (path) {
		case '/redirect-chain':
			response.writeHead(302, {
				Location: 'http://w.org/redirect-relative?step=2',
			});
			response.end('first intermediate response');
			return;

		case '/redirect-relative':
			response.writeHead(302, {
				Location: '/final?source=relative&token=kept',
			});
			response.end('second intermediate response');
			return;

		case '/redirect-to-blocked':
			response.writeHead(302, {
				Location: 'http://example.com/blocked',
			});
			response.end('blocked intermediate response');
			return;

		case '/redirect-302':
			response.writeHead(302, { Location: '/echo-request' });
			response.end();
			return;

		case '/redirect-303':
			response.writeHead(303, { Location: '/echo-request' });
			response.end();
			return;

		case '/redirect-307':
			response.writeHead(307, { Location: '/echo-request' });
			response.end();
			return;

		case '/loop':
			response.writeHead(302, { Location: '/loop' });
			response.end();
			return;

		case '/final':
		case '/echo-request':
			response.setHeader('Content-Type', 'application/json');
			response.end(
				JSON.stringify({
					host,
					method: request.method || 'GET',
					body,
					query: Object.fromEntries(requestUrl.searchParams),
				})
			);
			return;

		default:
			response.statusCode = 404;
			response.end('Not Found');
	}
}

async function readRequestBody(request: IncomingMessage) {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString();
}

function startPhpServer(args: string[], environment: Record<string, string>) {
	const child = spawn('php', args, {
		env: { ...process.env, ...environment },
		stdio: 'pipe',
	});
	const server: PhpServer = { process: child, output: '' };
	child.stdin.end();
	child.stdout.on('data', (chunk) => {
		server.output += chunk.toString();
	});
	child.stderr.on('data', (chunk) => {
		server.output += chunk.toString();
	});
	child.on('error', (error) => {
		server.spawnError = error;
	});
	return server;
}

async function waitForPhpServer(server: PhpServer, url: string) {
	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		if (server.spawnError) {
			throw server.spawnError;
		}
		if (hasPhpServerExited(server)) {
			throw new Error(`PHP server exited early:\n${server.output}`);
		}
		try {
			await fetch(url, { signal: AbortSignal.timeout(500) });
			return;
		} catch {
			await sleep(50);
		}
	}
	throw new Error(`Timed out waiting for PHP server:\n${server.output}`);
}

async function stopPhpServer(server: PhpServer | undefined) {
	if (!server || hasPhpServerExited(server)) {
		return;
	}
	const exited = once(server.process, 'exit');
	server.process.kill();
	await Promise.race([exited, sleep(1000)]);
	if (!hasPhpServerExited(server)) {
		const killed = once(server.process, 'exit');
		server.process.kill('SIGKILL');
		await killed;
	}
}

async function stopHttpServer(server: Server | undefined) {
	if (!server?.listening) {
		return;
	}
	await new Promise<void>((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}

function hasPhpServerExited(server: PhpServer) {
	return (
		server.process.exitCode !== null || server.process.signalCode !== null
	);
}

async function getAvailablePort(): Promise<number> {
	const server = createServer();
	const port = await listenOnAvailablePort(server);
	await stopHttpServer(server);
	return port;
}

async function listenOnAvailablePort(server: Server): Promise<number> {
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('Could not allocate port');
	}
	return address.port;
}

async function sleep(milliseconds: number) {
	await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type PhpServer = {
	process: ChildProcessWithoutNullStreams;
	output: string;
	spawnError?: Error;
};
