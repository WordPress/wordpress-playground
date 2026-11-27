import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server } from 'node:http';

/*
 * Helpers for Playwright specs that run a PHP endpoint under `php -S` and
 * record what it sends to local HTTP servers.
 */

export async function readRequestBody(request: IncomingMessage) {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString();
}

export function startPhpServer(
	args: string[],
	environment: Record<string, string>
) {
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

export async function waitForPhpServer(server: PhpServer, url: string) {
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

export async function stopPhpServer(server: PhpServer | undefined) {
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

export async function stopHttpServer(server: Server | undefined) {
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

export async function getAvailablePort(): Promise<number> {
	const server = createServer();
	const port = await listenOnAvailablePort(server);
	await stopHttpServer(server);
	return port;
}

export async function listenOnAvailablePort(server: Server): Promise<number> {
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

export type PhpServer = {
	process: ChildProcessWithoutNullStreams;
	output: string;
	spawnError?: Error;
};
