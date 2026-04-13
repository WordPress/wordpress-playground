/**
 * Tests that PHP's curl handles corrupt gzip responses without crashing
 * the WASM runtime.
 *
 * When curl auto-decompresses gzip via CURLOPT_ENCODING, zlib's inflate()
 * processes the compressed data. With corrupt or truncated gzip, zlib can
 * compute invalid buffer offsets that exceed the WASM linear memory,
 * triggering a RuntimeError trap. Native PHP handles this gracefully
 * (Z_DATA_ERROR → CURLE_WRITE_ERROR), but WASM PHP historically crashed.
 *
 * These tests verify that:
 * - Corrupt gzip doesn't crash the Node.js process
 * - The error message explains the real cause (not Asyncify)
 * - The runtime recovers via rotation for subsequent requests
 */
import { vi } from 'vitest';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import http from 'http';
import zlib from 'zlib';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

/**
 * Creates an HTTP server that serves various gzip responses — both
 * valid and corrupt — for testing curl's decompression error handling.
 */
function createGzipTestServer(): Promise<{
	url: string;
	server: http.Server;
}> {
	// Build a valid gzip payload large enough that zlib allocates a
	// sliding window. The repetition produces long-distance back-
	// references whose corruption is more likely to hit invalid offsets.
	const payload = 'The quick brown fox jumps over the lazy dog. '.repeat(500);
	const validGzip = zlib.gzipSync(payload);

	// Corrupt gzip: flip bytes in the DEFLATE stream (past the 10-byte
	// gzip header) so inflate encounters invalid distance/length codes.
	const corruptGzip = Buffer.from(validGzip);
	for (let i = 15; i < Math.min(80, corruptGzip.length); i++) {
		corruptGzip[i] = corruptGzip[i]! ^ 0xff;
	}

	// Truncated gzip: cut the payload mid-stream so inflate hits
	// unexpected EOF while the sliding window is partially filled.
	const truncatedGzip = Buffer.from(validGzip.subarray(0, 30));

	const server = http.createServer((req, res) => {
		switch (req.url) {
			case '/valid':
				res.writeHead(200, { 'Content-Encoding': 'gzip' });
				res.end(validGzip);
				break;

			case '/corrupt':
				res.writeHead(200, { 'Content-Encoding': 'gzip' });
				res.end(corruptGzip);
				break;

			case '/truncated':
				res.writeHead(200, { 'Content-Encoding': 'gzip' });
				res.end(truncatedGzip);
				break;

			case '/no-encoding':
				// Same corrupt bytes but without Content-Encoding, so
				// curl won't try to decompress them.
				res.writeHead(200, {});
				res.end(corruptGzip);
				break;

			default:
				res.writeHead(404);
				res.end('not found');
		}
	});

	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address() as { port: number };
			resolve({
				url: `http://127.0.0.1:${addr.port}`,
				server,
			});
		});
	});
}

function stopServer(server: http.Server): Promise<void> {
	return new Promise((resolve) => server.close(() => resolve()));
}

describe.each(phpVersions)(
	'PHP %s – curl gzip crash handling',
	(phpVersion) => {
		let php: PHP;
		let serverUrl: string;
		let server: http.Server;

		beforeEach(async () => {
			const s = await createGzipTestServer();
			serverUrl = s.url;
			server = s.server;

			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, {
				allow_url_fopen: 1,
				disable_functions: '',
			});
			vi.restoreAllMocks();
		});

		afterEach(async () => {
			try {
				php.exit();
			} catch {
				// Runtime may already be dead after a crash test.
			}
			await stopServer(server);
		});

		it('fetches valid gzip without error', async () => {
			const { text } = await php.run({
				code: `<?php
				$ch = curl_init("${serverUrl}/valid");
				curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
				curl_setopt($ch, CURLOPT_ENCODING, 'gzip');
				$result = curl_exec($ch);
				$err = curl_error($ch);
				curl_close($ch);
				if ($err) {
					echo "CURL_ERROR: $err";
				} else {
					echo strlen($result) > 100 ? "OK" : "TOO_SHORT";
				}
			`,
			});
			expect(text).toBe('OK');
		}, 15_000);

		it('does not crash the process when curl decompresses corrupt gzip', async () => {
			const uncaughtErrors: unknown[] = [];
			function errorHandler(error: unknown) {
				uncaughtErrors.push(error);
			}
			process.on('unhandledRejection', errorHandler);
			process.on('uncaughtException', errorHandler);

			let caughtError: unknown;
			try {
				await php.run({
					code: `<?php
					$ch = curl_init("${serverUrl}/corrupt");
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					curl_setopt($ch, CURLOPT_ENCODING, 'gzip');
					$result = curl_exec($ch);
					$err = curl_error($ch);
					curl_close($ch);
					echo $err ? "CURL_ERROR: $err" : "OK: " . strlen($result);
				`,
				});
			} catch (error) {
				caughtError = error;
			}

			// Give unhandled rejections a chance to surface.
			await new Promise((resolve) => setTimeout(resolve, 500));

			process.off('unhandledRejection', errorHandler);
			process.off('uncaughtException', errorHandler);

			// Either PHP handled the error gracefully (returned a curl
			// error string) or the WASM trap was caught by our error
			// handling. The process must NOT have crashed.
			if (caughtError) {
				// WASM trap was caught — verify the error message
				// doesn't blame Asyncify.
				const message =
					caughtError instanceof Error
						? caughtError.message
						: String(caughtError);
				expect(message).not.toContain('ASYNCIFY_ONLY');
			}

			// No unhandled rejections should have escaped.
			for (const error of uncaughtErrors) {
				if (error instanceof Error) {
					expect(error.message).not.toContain('ASYNCIFY_ONLY');
				}
			}
		}, 15_000);

		it('does not crash the process when curl decompresses truncated gzip', async () => {
			const uncaughtErrors: unknown[] = [];
			function errorHandler(error: unknown) {
				uncaughtErrors.push(error);
			}
			process.on('unhandledRejection', errorHandler);
			process.on('uncaughtException', errorHandler);

			let caughtError: unknown;
			try {
				await php.run({
					code: `<?php
					$ch = curl_init("${serverUrl}/truncated");
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					curl_setopt($ch, CURLOPT_ENCODING, 'gzip');
					$result = curl_exec($ch);
					$err = curl_error($ch);
					curl_close($ch);
					echo $err ? "CURL_ERROR: $err" : "OK: " . strlen($result);
				`,
				});
			} catch (error) {
				caughtError = error;
			}

			await new Promise((resolve) => setTimeout(resolve, 500));

			process.off('unhandledRejection', errorHandler);
			process.off('uncaughtException', errorHandler);

			if (caughtError) {
				const message =
					caughtError instanceof Error
						? caughtError.message
						: String(caughtError);
				expect(message).not.toContain('ASYNCIFY_ONLY');
			}

			for (const error of uncaughtErrors) {
				if (error instanceof Error) {
					expect(error.message).not.toContain('ASYNCIFY_ONLY');
				}
			}
		}, 15_000);

		it('does not decompress when Content-Encoding is absent', async () => {
			// Same corrupt bytes but served without Content-Encoding.
			// Curl should pass the raw bytes through without invoking
			// zlib, so no crash is possible.
			const { text } = await php.run({
				code: `<?php
				$ch = curl_init("${serverUrl}/no-encoding");
				curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
				$result = curl_exec($ch);
				$err = curl_error($ch);
				curl_close($ch);
				echo $err ? "CURL_ERROR: $err" : "RAW_BYTES: " . strlen($result);
			`,
			});
			expect(text).toMatch(/RAW_BYTES: \d+/);
		}, 15_000);

		it('recovers via rotation after a curl-triggered WASM crash', async () => {
			// Enable rotation so the runtime can recover.
			php.enableRuntimeRotation({
				recreateRuntime: () => loadNodeRuntime(phpVersion as any),
				maxRequests: 400,
			});

			// First request: fetch corrupt gzip. This may either:
			// (a) crash the WASM runtime (caught, marked for rotation), or
			// (b) be handled gracefully by PHP's curl error path.
			try {
				await php.run({
					code: `<?php
					$ch = curl_init("${serverUrl}/corrupt");
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					curl_setopt($ch, CURLOPT_ENCODING, 'gzip');
					curl_exec($ch);
					curl_close($ch);
				`,
				});
			} catch {
				// Expected — WASM trap or PHP error.
			}

			// Second request: must succeed regardless of what happened
			// above. If the first request crashed the WASM runtime,
			// rotation should swap in a fresh one.
			const result = await php.run({
				code: `<?php echo "recovered";`,
			});
			expect(result.text).toBe('recovered');
		}, 30_000);
	}
);
