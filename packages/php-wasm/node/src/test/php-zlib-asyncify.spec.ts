/**
 * Regression test for Asyncify corrupting zlib state.
 *
 * THE BUG
 * =======
 *
 * When PHP code does network I/O inside a CURLOPT_WRITEFUNCTION
 * callback while curl is auto-decompressing a gzip response, the
 * Asyncify stack unwind passes through zlib's inflate(). On rewind,
 * zlib's local variables (window pointers, bit accumulators) are
 * corrupted because inflate/inflate_fast/inflate_table were missing
 * from the ASYNCIFY_ONLY list. The next updatewindow() call uses
 * the corrupted pointer and hits an out-of-bounds WASM memory
 * access → RuntimeError: unreachable.
 *
 * THE FIX
 * =======
 *
 * Add inflate, inflate_fast, and inflate_table to the ASYNCIFY_ONLY
 * list in the PHP Dockerfile so Asyncify properly saves and restores
 * their state during unwind/rewind.
 *
 * CALL CHAIN DURING THE CRASH
 * ===========================
 *
 *   PHP userland
 *     → curl_exec()
 *       → curl_multi_perform()
 *         → Curl_httpchunk_read()
 *           → gzip_unencode_write()
 *             → inflate()            ← zlib, on the WASM stack
 *               → [inflate returns partial output]
 *             → WRITEFUNCTION callback
 *               → file_get_contents("http://...")
 *                 → ★ Asyncify UNWINDS here ★
 *                   (inflate's locals saved incorrectly
 *                    because inflate wasn't in ASYNCIFY_ONLY)
 *                 → ★ Asyncify REWINDS ★
 *                   (inflate's locals restored with garbage)
 *             → inflate() again
 *               → updatewindow()
 *                 → zmemcpy(corrupted_pointer, ...) → WASM TRAP
 *
 * WHY NATIVE PHP IS FINE
 * ======================
 *
 * Native PHP blocks synchronously on the network I/O. The WASM stack
 * is never unwound, so zlib's locals are never disturbed.
 *
 * WHY JSPI IS FINE
 * ================
 *
 * JSPI suspends the entire WASM instance without touching individual
 * stack frames. zlib's locals are preserved because no unwind happens.
 */
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';
import http from 'http';
import zlib from 'zlib';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

/**
 * Creates a gzip-compressed chunked HTTP server that sends 50 SQL
 * chunks with Z_SYNC_FLUSH between them — enough to fill zlib's
 * 32KB sliding window and exercise updatewindow() on every flush.
 */
function createGzipChunkedServer(): Promise<{
	url: string;
	server: http.Server;
}> {
	return new Promise((resolve) => {
		const server = http.createServer((req, res) => {
			if (req.url === '/ping') {
				res.writeHead(200);
				res.end('pong');
				return;
			}

			res.writeHead(200, {
				'Content-Type': 'text/plain',
				'Content-Encoding': 'gzip',
				'Transfer-Encoding': 'chunked',
			});

			const gz = zlib.createGzip({ level: 6 });
			gz.on('data', (chunk) => res.write(chunk));
			gz.on('end', () => res.end());

			let i = 0;
			const total = 50;

			function writeNext() {
				if (i >= total) {
					gz.end();
					return;
				}

				// ~16KB of SQL per chunk — fills the window quickly
				const rows: string[] = [];
				for (let r = 0; r < 100; r++) {
					rows.push(
						`(${i * 100 + r}, 'post_${i}_${r}', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.')`
					);
				}
				gz.write(`INSERT INTO wp_posts VALUES ${rows.join(',\n')};\n`);
				i++;
				gz.flush(zlib.constants.Z_SYNC_FLUSH, writeNext);
			}

			writeNext();
		});

		server.listen(0, '127.0.0.1', () => {
			const port = (server.address() as { port: number }).port;
			resolve({ url: `http://127.0.0.1:${port}`, server });
		});
	});
}

describe.each(phpVersions)(
	'PHP %s – zlib asyncify safety',
	async (phpVersion) => {
		// This bug only affects the asyncify build. JSPI suspends the
		// whole instance without stack unwinding so it's not affected.
		if (await jspi()) {
			it.skip('JSPI is available — this test targets asyncify only', () => {});
			return;
		}

		let serverUrl: string;
		let server: http.Server;

		beforeAll(async () => {
			const s = await createGzipChunkedServer();
			serverUrl = s.url;
			server = s.server;
		});

		afterAll(async () => {
			await new Promise<void>((r) => server.close(() => r()));
		});

		// The crash is intermittent — depends on Asyncify unwind timing
		// relative to inflate() execution. Run multiple times to catch it.
		for (let run = 1; run <= 10; run++) {
			it(`run ${run}: async I/O inside curl gzip WRITEFUNCTION does not crash`, async () => {
				const php = new PHP(await loadNodeRuntime(phpVersion as any));
				await setPhpIniEntries(php, {
					allow_url_fopen: 1,
					disable_functions: '',
				});

				try {
					const result = await php.run({
						code: `<?php
							// The gzip server sends 50 SQL chunks with
							// Z_SYNC_FLUSH. The /ping endpoint is a
							// lightweight HTTP request that triggers
							// Asyncify unwind while inflate() is still
							// on the call stack.
							$n = 0;
							$ch = curl_init("${serverUrl}/");
							curl_setopt_array($ch, [
								CURLOPT_TIMEOUT        => 30,
								CURLOPT_ENCODING       => 'gzip, deflate',
								CURLOPT_RETURNTRANSFER => false,
								CURLOPT_WRITEFUNCTION  => function ($ch, $data) use (&$n) {
									// Async I/O: this triggers Asyncify
									// unwind through inflate's stack frame
									@file_get_contents("${serverUrl}/ping");
									$n++;
									return strlen($data);
								},
							]);
							$ok = curl_exec($ch);
							$errno = curl_errno($ch);
							echo $errno ? "CURL_ERROR:$errno" : "OK:$n";
						`,
					});
					// We accept either success or a curl error —
					// the point is no WASM trap.
					expect(result.text).toMatch(/OK:|CURL_ERROR:/);
				} finally {
					try {
						php.exit();
					} catch {
						// Runtime may be dead after a crash
					}
				}
			}, 60_000);
		}
	}
);
