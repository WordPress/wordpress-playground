import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe.skipIf(!isPhpBinaryAvailable())('remote access relay.php', () => {
	let server: ChildProcessWithoutNullStreams;
	let relayUrl: string;
	let stderr = '';
	let documentRoot: string;

	beforeAll(async () => {
		documentRoot = await mkdtemp(join(tmpdir(), 'playground-relay-'));
		const relay = await readFile(
			join(getRelayDocumentRoot(), 'relay.php'),
			'utf8'
		);
		// Always select the 1% housekeeping branch. Authorization/validation errors
		// must not require a database or have their responses replaced by cleanup errors.
		expect(relay).toContain('random_int(1, 100)');
		await writeFile(
			join(documentRoot, 'relay.php'),
			relay.replace('random_int(1, 100)', '1').replace(
				'if ($relayAction !== null) {',
				// Isolate housekeeping after a successful response from the real
				// endpoints' own database requirements. Cleanup itself is unchanged.
				`if ($relayAction === '__test_success') {
    jsonResponse(['ok' => true]);
} elseif ($relayAction !== null) {`
			)
		);
		const port = await getAvailablePort();
		relayUrl = `http://127.0.0.1:${port}/relay.php`;
		server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', documentRoot], {
			stdio: ['ignore', 'pipe', 'pipe'],
			// Housekeeping must fail locally without connecting to a developer's DB.
			env: { ...process.env, PLAYGROUND_RELAY_DB_HOST: '', DB_HOST: '' },
		});
		server.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});
		await waitForRelay(
			relayUrl,
			() => server.exitCode !== null,
			() => stderr
		);
	}, 15000);

	afterAll(async () => {
		if (server && server.exitCode === null) {
			await new Promise<void>((resolve) => {
				server.once('exit', () => resolve());
				server.kill();
			});
		}
		if (documentRoot)
			await rm(documentRoot, { recursive: true, force: true });
	});

	/*
	 * The host role is what makes the verification-code approval meaningful:
	 * only the host may offer to a guest and read the guest's replies. These
	 * cases cover the rejection that happens before any session lookup, so
	 * they need no database.
	 */
	it('rejects host signal posts without a host token', async () => {
		const response = await fetch(
			`${relayUrl}?action=signal&sessionId=session-1`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: 'host',
					to: 'guest',
					type: 'offer',
					data: {},
				}),
			}
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'Missing host token',
		});
	});

	it('rejects host signal polls without a host token', async () => {
		const response = await fetch(
			`${relayUrl}?action=signal&sessionId=session-1&to=host&since=0`
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'Missing host token',
		});
	});

	it('rejects session close without a host token', async () => {
		const response = await fetch(
			`${relayUrl}?action=close&sessionId=session-1`,
			{ method: 'POST' }
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'Missing host token',
		});
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

	it('preserves an unknown action response without database cleanup', async () => {
		const response = await fetch(`${relayUrl}?action=missing`);
		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'Not found' });
		expect(stderr).not.toContain('relay error:');
	});

	it('preserves a successful response when housekeeping cannot reach the database', async () => {
		const response = await fetch(`${relayUrl}?action=__test_success`);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ ok: true });
		await vi.waitFor(() => {
			expect(stderr).toContain('Remote access relay cleanup error:');
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
