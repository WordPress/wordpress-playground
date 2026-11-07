import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { loadNodeRuntime } from '@php-wasm/node';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { PHP, SupportedPHPVersions } from '@php-wasm/universal';

const phpVersion = process.env.PHP_VERSION as SupportedPHPVersion;
if (!phpVersion) {
	throw new Error('PHP_VERSION is not set');
}
if (!SupportedPHPVersions.includes(phpVersion)) {
	throw new Error(`PHP_VERSION '${phpVersion}' is not supported`);
}

describe(`PHP ${phpVersion}`, () => {
	it('Should open a TCP connection', { timeout: 60000 }, async () => {
		const server = net.createServer((socket) => socket.end('pong'));
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const { port } = server.address() as net.AddressInfo;
		const php = new PHP(
			await loadNodeRuntime(phpVersion, {
				emscriptenOptions: { processId: 1 },
			})
		);
		try {
			const { text } = await php.run({
				code: `<?php
				$socket = fsockopen('127.0.0.1', ${port}, $errno, $errstr, 5);
				echo $socket ? stream_get_contents($socket) : "$errno $errstr";
				`,
			});
			assert.equal(text, 'pong');
		} finally {
			php.exit();
			server.close();
		}
	});

	/**
	 * The compiled PHP runtime loads `ws` when PHP opens a socket. Without it,
	 * every connection fails with "host unreachable". This test project sits
	 * inside the repository, whose node_modules would hide a missing
	 * dependency from the test above, so check the published package itself.
	 */
	it('Should depend on ws, which PHP loads to open sockets', async () => {
		const packageJsonPath = fileURLToPath(
			import.meta.resolve('@php-wasm/node/package.json')
		);
		const { dependencies } = JSON.parse(
			await readFile(packageJsonPath, 'utf8')
		);
		assert.ok(dependencies?.ws, '@php-wasm/node must depend on ws');
	});
});
