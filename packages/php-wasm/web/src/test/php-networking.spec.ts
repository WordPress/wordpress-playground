import test from '@playwright/test';
import http from 'http';
import zlib from 'zlib';
import type { AddressInfo } from 'net';

const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(100);

test.describe('PHP networking through tcp-over-fetch bridge', () => {
	let mockServer: http.Server;
	let serverUrl: string;

	test.beforeAll(async () => {
		mockServer = http.createServer((req, res) => {
			// Allow cross-origin requests from the Playwright dev server
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
			res.setHeader('Access-Control-Allow-Headers', '*');
			if (req.method === 'OPTIONS') {
				res.writeHead(204);
				res.end();
				return;
			}

			const url = new URL(req.url!, `http://${req.headers.host}`);
			switch (url.pathname) {
				case '/plain': {
					res.setHeader('Content-Type', 'text/plain');
					res.end(longText);
					break;
				}
				case '/gzipped': {
					const compressed = zlib.gzipSync(longText);
					res.setHeader('Content-Type', 'text/plain');
					res.setHeader('Content-Encoding', 'gzip');
					res.setHeader(
						'Content-Length',
						compressed.length.toString()
					);
					res.end(compressed);
					break;
				}
				case '/brotli': {
					const compressed = zlib.brotliCompressSync(longText);
					res.setHeader('Content-Type', 'text/plain');
					res.setHeader('Content-Encoding', 'br');
					res.setHeader(
						'Content-Length',
						compressed.length.toString()
					);
					res.end(compressed);
					break;
				}
				default:
					res.writeHead(404);
					res.end('Not Found');
			}
		});

		await new Promise<void>((resolve) => {
			mockServer.listen(0, '127.0.0.1', () => resolve());
		});
		const addr = mockServer.address() as AddressInfo;
		serverUrl = `http://127.0.0.1:${addr.port}`;
	});

	test.afterAll(() => {
		mockServer?.close();
	});

	test.beforeEach(async ({ page }) => {
		page.on('console', (log) => console.log(log.text()));
		await page.goto('/');
		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/globals.ts',
		});
	});

	test('PHP curl receives decompressed body for gzip-compressed response', async ({
		page,
	}) => {
		const result = await page.evaluate(async (url: string) => {
			const CAroot = await window.generateCertificate({
				subject: {
					commonName: 'TestCA',
					organizationName: 'Test',
					countryName: 'US',
				},
				basicConstraints: { ca: true },
			});

			const php = new window.PHP(
				await window.loadWebRuntime('8.4', {
					tcpOverFetch: { CAroot },
				})
			);

			await window.setPhpIniEntries(php, {
				allow_url_fopen: '1',
				disable_functions: '',
			});

			const response = await php.runStream({
				code: `<?php
					$ch = curl_init('${url}/gzipped');
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					$body = curl_exec($ch);
					$error = curl_error($ch);
					$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
					curl_close($ch);
					echo json_encode([
						'code' => $code,
						'error' => $error,
						'bodyLength' => strlen($body),
						'bodyStart' => substr($body, 0, 50),
					]);
				`,
			});
			const text = await response.stdoutText;
			php.exit();
			return text;
		}, serverUrl);

		const parsed = JSON.parse(result);
		test.expect(parsed.code).toBe(200);
		test.expect(parsed.error).toBe('');
		test.expect(parsed.bodyLength).toBe(longText.length);
		test.expect(parsed.bodyStart).toBe(longText.slice(0, 50));
	});

	test('PHP curl receives decompressed body for brotli-compressed response', async ({
		page,
	}) => {
		const result = await page.evaluate(async (url: string) => {
			const CAroot = await window.generateCertificate({
				subject: {
					commonName: 'TestCA',
					organizationName: 'Test',
					countryName: 'US',
				},
				basicConstraints: { ca: true },
			});

			const php = new window.PHP(
				await window.loadWebRuntime('8.4', {
					tcpOverFetch: { CAroot },
				})
			);

			await window.setPhpIniEntries(php, {
				allow_url_fopen: '1',
				disable_functions: '',
			});

			const response = await php.runStream({
				code: `<?php
					$ch = curl_init('${url}/brotli');
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					$body = curl_exec($ch);
					$error = curl_error($ch);
					$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
					curl_close($ch);
					echo json_encode([
						'code' => $code,
						'error' => $error,
						'bodyLength' => strlen($body),
						'bodyStart' => substr($body, 0, 50),
					]);
				`,
			});
			const text = await response.stdoutText;
			php.exit();
			return text;
		}, serverUrl);

		const parsed = JSON.parse(result);
		test.expect(parsed.code).toBe(200);
		test.expect(parsed.error).toBe('');
		test.expect(parsed.bodyLength).toBe(longText.length);
		test.expect(parsed.bodyStart).toBe(longText.slice(0, 50));
	});
});
