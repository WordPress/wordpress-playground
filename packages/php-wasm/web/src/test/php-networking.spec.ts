import test from '@playwright/test';
import http from 'http';
import http2 from 'http2';
import zlib from 'zlib';
import type { AddressInfo } from 'net';
import {
	cleanupCertificate,
	generateCertificate,
} from './utils/generate-certificate';

const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(100);

test.describe('PHP networking through tcp-over-fetch bridge', () => {
	let mockServer: http.Server;
	let corsProxyServer: http2.Http2SecureServer;
	let serverUrl: string;
	let corsProxyUrl: string;

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
				case '/upload': {
					const chunks: Buffer[] = [];
					req.on('data', (chunk: Buffer) => chunks.push(chunk));
					req.on('end', () => {
						const body = Buffer.concat(chunks).toString('utf-8');
						res.setHeader('Content-Type', 'application/json');
						res.end(
							JSON.stringify({
								contentType: req.headers['content-type'] || '',
								bodyLength: body.length,
								body,
							})
						);
					});
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

		const { cert, key } = await generateCertificate();
		corsProxyServer = http2.createSecureServer(
			{ allowHTTP1: true, cert, key },
			(req, res) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
				res.setHeader('Access-Control-Allow-Headers', '*');
				res.setHeader(
					'Access-Control-Expose-Headers',
					'X-Playground-Cors-Proxy'
				);
				res.setHeader('X-Playground-Cors-Proxy', 'true');
				if (req.method === 'OPTIONS') {
					res.writeHead(204);
					res.end();
					return;
				}

				const chunks: Buffer[] = [];
				req.on('data', (chunk: Buffer) => chunks.push(chunk));
				req.on('end', () => {
					const body = Buffer.concat(chunks).toString('utf-8');
					res.setHeader('Content-Type', 'application/json');
					res.end(
						JSON.stringify({
							contentType:
								req.headers['x-cors-proxy-content-type'] ||
								req.headers['content-type'] ||
								'',
							bodyLength: body.length,
							body,
						})
					);
				});
			}
		);
		await new Promise<void>((resolve) => {
			corsProxyServer.listen(0, '127.0.0.1', () => resolve());
		});
		const corsProxyAddr = corsProxyServer.address() as AddressInfo;
		corsProxyUrl = `https://127.0.0.1:${corsProxyAddr.port}/`;
	});

	test.afterAll(() => {
		mockServer?.close();
		corsProxyServer?.close();
		cleanupCertificate();
	});

	test.beforeEach(async ({ page }) => {
		page.on('console', (log) => console.log(log.text()));
		await page.goto('/');
		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/browser-globals.ts',
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

	test('PHP curl can verify HTTPS peers via the curl.cainfo CA bundle', async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
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

			const caBundlePath = '/internal/shared/ca-bundle.crt';
			php.mkdir('/internal/shared');
			php.writeFile(
				caBundlePath,
				window.certificateToPEM(CAroot.certificate)
			);

			await window.setPhpIniEntries(php, {
				allow_url_fopen: '1',
				disable_functions: '',
				'openssl.cafile': caBundlePath,
				'curl.cainfo': caBundlePath,
			});

			const response = await php.runStream({
				code: `<?php
					$ch = curl_init('https://api.wordpress.org/stats/php/1.0/');
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					$body = curl_exec($ch);
					$error = curl_error($ch);
					$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
					curl_close($ch);
					$json = json_decode($body, true);
					echo json_encode([
						'code' => $code,
						'error' => $error,
						'has83' => is_array($json) && array_key_exists('8.3', $json),
					]);
				`,
			});
			const text = await response.stdoutText;
			php.exit();
			return text;
		});

		const parsed = JSON.parse(result);
		test.expect(parsed.code).toBe(200);
		test.expect(parsed.error).toBe('');
		test.expect(parsed.has83).toBe(true);
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

	test('PHP curl can upload a local file via CURLFile', async ({ page }) => {
		const result = await page.evaluate(async (proxyUrl: string) => {
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
					tcpOverFetch: {
						CAroot,
						corsProxyUrl: proxyUrl,
					},
				})
			);

			await window.setPhpIniEntries(php, {
				allow_url_fopen: '1',
				disable_functions: '',
			});

			const response = await php.runStream({
				code: `<?php
					$fileContents = str_repeat('CURLFile upload payload ', 20000);
					$tmp = tempnam('/tmp', 'curlfile');
					file_put_contents($tmp, $fileContents);

					$ch = curl_init('http://remote-server.example/upload');
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					curl_setopt($ch, CURLOPT_POST, true);
					curl_setopt($ch, CURLOPT_POSTFIELDS, [
						'file' => new CURLFile($tmp, 'text/plain', 'payload.txt'),
						'field1' => 'value1',
					]);

					$result = curl_exec($ch);
					echo json_encode([
						'readableLength' => strlen(file_get_contents($tmp)),
						'curlError' => curl_error($ch),
						'httpCode' => curl_getinfo($ch, CURLINFO_HTTP_CODE),
						'response' => $result,
					]);
					curl_close($ch);
				`,
			});
			const text = await response.stdoutText;
			php.exit();
			return text;
		}, corsProxyUrl);

		const parsed = JSON.parse(result);
		test.expect(parsed).toMatchObject({
			curlError: '',
			httpCode: 200,
		});
		test.expect(parsed.response).not.toBe('');
		const response = JSON.parse(parsed.response);
		test.expect(parsed.readableLength).toBeGreaterThan(400_000);
		test.expect(response.contentType).toContain('multipart/form-data');
		test.expect(response.body).toContain('payload.txt');
		test.expect(response.body).toContain('CURLFile upload payload ');
		test.expect(response.body).toContain('value1');
	});
});
