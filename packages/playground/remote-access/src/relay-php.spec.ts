import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import { createServer } from 'net';
import { delimiter, join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe.skipIf(!isPhpBinaryAvailable())('remote access relay.php', () => {
	let server: ChildProcessWithoutNullStreams;
	let relayUrl: string;
	let stderr = '';

	beforeAll(async () => {
		const port = await getAvailablePort();
		relayUrl = `http://127.0.0.1:${port}/relay.php`;
		server = spawn(
			'php',
			['-S', `127.0.0.1:${port}`, '-t', getRelayDocumentRoot()],
			{
				stdio: ['ignore', 'pipe', 'pipe'],
			}
		);
		server.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});
		await waitForRelay(
			relayUrl,
			() => server.exitCode !== null,
			() => stderr
		);
	}, 15000);

	afterAll(() => {
		server?.kill();
	});

	it('rejects oversized guest ids before reading session state', async () => {
		const oversizedGuestId = 'x'.repeat(37);

		const response = await fetch(
			`${relayUrl}?action=status&sessionId=session-1&gid=${oversizedGuestId}`
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'Invalid guest id',
		});
	});
});

async function waitForRelay(
	relayUrl: string,
	hasExited: () => boolean,
	getStderr: () => string
) {
	const deadline = Date.now() + 10000;
	while (Date.now() < deadline) {
		if (hasExited()) {
			throw new Error(`relay.php server exited early:\n${getStderr()}`);
		}
		try {
			await fetch(`${relayUrl}?action=missing`);
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	throw new Error(`Timed out waiting for relay.php server:\n${getStderr()}`);
}

function isPhpBinaryAvailable() {
	return (process.env.PATH ?? '')
		.split(delimiter)
		.filter(Boolean)
		.some((path) => existsSync(join(path, 'php')));
}

async function getAvailablePort(): Promise<number> {
	return await new Promise((resolve, reject) => {
		const server = createServer();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close(() =>
					reject(new Error('Could not allocate port'))
				);
				return;
			}
			server.close(() => resolve(address.port));
		});
	});
}

function getRelayDocumentRoot() {
	const candidates = [
		process.cwd(),
		join(process.cwd(), 'packages/playground/remote-access'),
	];
	const documentRoot = candidates.find((candidate) =>
		existsSync(join(candidate, 'relay.php'))
	);
	if (!documentRoot) {
		throw new Error('Could not find remote access relay.php');
	}
	return documentRoot;
}
