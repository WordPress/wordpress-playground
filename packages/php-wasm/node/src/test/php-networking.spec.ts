import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
	popLoadedRuntime,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import express from 'express';
import { createServer as createTlsServer, rootCertificates } from 'tls';
import { loadNodeRuntime } from '../lib';
import type { PHPLoaderOptions } from '../lib';
import http from 'http';
import https from 'https';
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';

const phpVersions =
	'PHP' in process.env
		? [process.env['PHP']! as SupportedPHPVersion]
		: SupportedPHPVersions;

const phpLoaderOptions: PHPLoaderOptions[] = [{}, { extensions: ['xdebug'] }];

describe.each(phpVersions)('PHP %s', (phpVersion) => {
	let server: any;
	async function startServer() {
		const app = express();
		app.use('/', async (req: any, res: any) => {
			res.end('response from express');
		});

		app.use('/redirect', async (req: any, res: any) => {
			res.redirect('/');
		});

		server = await new Promise<any>((resolve) => {
			const _server = app.listen(() => {
				resolve(_server);
			});
		});

		return 'http://127.0.0.1:' + server.address().port;
	}
	async function startUploadServer() {
		const app = express();
		app.post('/upload', async (req: any, res: any) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk: Buffer) => chunks.push(chunk));
			req.on('end', () => {
				const body = Buffer.concat(chunks).toString('utf-8');
				const contentType = req.headers['content-type'] || '';
				res.json({
					contentType,
					bodyLength: body.length,
					body,
				});
			});
		});

		server = await new Promise<any>((resolve) => {
			const _server = app.listen(() => {
				resolve(_server);
			});
		});

		return 'http://127.0.0.1:' + server.address().port;
	}
	async function startRedirectUploadServer() {
		server = http.createServer((req, res) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk: Buffer) => chunks.push(chunk));
			req.on('end', () => {
				if (req.url === '/redirect') {
					res.writeHead(307, { Location: '/upload' });
					res.end();
				} else {
					res.end(Buffer.concat(chunks));
				}
			});
		});
		await new Promise<void>((resolve) => server.listen(0, resolve));
		return 'http://127.0.0.1:' + server.address().port;
	}
	async function stopServer(server: any) {
		if (server) {
			await new Promise((resolve) => {
				server.close(resolve);
			});
			server = undefined;
		}
	}

	phpLoaderOptions.forEach((options) => {
		if (phpVersion === '8.6') {
			it('resumes a TLS stream session', async () => {
				let php: PHP | undefined;
				const resumed: boolean[] = [];
				try {
					const certificate = readFileSync(
						new URL('./test-data/cert.pem', import.meta.url)
					);
					server = createTlsServer(
						{
							cert: certificate,
							key: readFileSync(
								new URL('./test-data/key.pem', import.meta.url)
							),
							maxVersion: 'TLSv1.2',
						},
						(socket) => {
							resumed.push(socket.isSessionReused());
							socket.end('secure stream');
						}
					);
					await new Promise<void>((resolve) =>
						server.listen(0, resolve)
					);
					const address = `tls://127.0.0.1:${server.address().port}`;
					php = new PHP(await loadNodeRuntime(phpVersion, options));
					await setPhpIniEntries(php, { disable_functions: '' });
					php.writeFile('/tmp/test-ca.pem', certificate);
					const response = await php.run({
						code: `<?php
							$session = null;
							$options = [
								'cafile' => '/tmp/test-ca.pem',
								'peer_name' => '127.0.0.1',
								'crypto_method' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT,
								'session_new_cb' => function ($stream, $newSession) use (&$session) {
									$session = $newSession;
								},
							];
							$first = stream_socket_client('${address}', $errno, $error, 4, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => $options]));
							$firstBody = stream_get_contents($first);
							fclose($first);
							if ($session === null) {
								throw new Exception('No TLS session was captured');
							}
							unset($options['session_new_cb']);
							$options['session_data'] = $session;
							$second = stream_socket_client('${address}', $errno, $error, 4, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => $options]));
							$secondBody = stream_get_contents($second);
							fclose($second);
							echo json_encode([$firstBody, $secondBody]);
						`,
					});
					expect(JSON.parse(response.text)).toEqual([
						'secure stream',
						'secure stream',
					]);
					expect(resumed).toEqual([false, true]);
				} finally {
					php?.exit();
					await stopServer(server);
				}
			}, 15000);

			it('polls multiple network streams for readiness', async () => {
				let php: PHP | undefined;
				try {
					const serverUrl = await startServer();
					php = new PHP(await loadNodeRuntime(phpVersion, options));
					await setPhpIniEntries(php, {
						disable_functions: '',
					});
					const response = await php.run({
						code: `<?php
							$address = str_replace('http://', 'tcp://', '${serverUrl}');
							$readSocket = stream_socket_client($address);
							$writeSocket = stream_socket_client($address);
							$poll = new Io\\Poll\\Context(Io\\Poll\\Backend::Poll);
							$poll->add(new StreamPollHandle($readSocket), [Io\\Poll\\Event::Read]);
							$poll->add(new StreamPollHandle($writeSocket), [Io\\Poll\\Event::Write]);
							$ready = $poll->wait(Time\\Duration::fromSeconds(1));
							echo count($ready) . ':' . ($ready[0]->getHandle()->getStream() === $writeSocket ? 'write' : 'unexpected');
							fclose($readSocket);
							fclose($writeSocket);
						`,
					});

					expect(response.text).toBe('1:write');
				} finally {
					php?.exit();
					await stopServer(server);
				}
			}, 10000);

			it('waits for the polling timeout when a socket is idle', async () => {
				let php: PHP | undefined;
				try {
					const serverUrl = await startServer();
					php = new PHP(await loadNodeRuntime(phpVersion, options));
					await setPhpIniEntries(php, {
						disable_functions: '',
					});
					const response = await php.run({
						code: `<?php
							$socket = stream_socket_client(str_replace('http://', 'tcp://', '${serverUrl}'));
							$poll = new Io\\Poll\\Context(Io\\Poll\\Backend::Poll);
							$poll->add(new StreamPollHandle($socket), [Io\\Poll\\Event::Read]);
							$start = hrtime(true);
							$ready = $poll->wait(Time\\Duration::fromMilliseconds(60));
							echo count($ready) . ':' . (hrtime(true) - $start >= 30000000 ? 'waited' : 'early');
							fclose($socket);
						`,
					});

					expect(response.text).toBe('0:waited');
				} finally {
					php?.exit();
					await stopServer(server);
				}
			}, 10000);
		}

		it('should be able to make a request to a server', async () => {
			let php: PHP | undefined;
			try {
				const serverUrl = await startServer();
				php = new PHP(await loadNodeRuntime(phpVersion, options));
				await setPhpIniEntries(php, {
					allow_url_fopen: 1,
					disable_functions: '',
				});
				php.writeFile(
					'/tmp/test.php',
					`<?php
					echo file_get_contents("${serverUrl}");
					`
				);
				const { text } = await php.run({
					scriptPath: '/tmp/test.php',
				});
				expect(text).toEqual('response from express');
			} finally {
				php?.exit();
				await stopServer(server);
			}
		});

		it('should support fopen() and fread() until EOF', async () => {
			let php: PHP | undefined;
			try {
				const serverUrl = await startServer();
				php = new PHP(await loadNodeRuntime(phpVersion, options));
				await setPhpIniEntries(php, {
					allow_url_fopen: 1,
					disable_functions: '',
				});

				php.writeFile(
					'/tmp/test.php',
					`<?php
					$url = str_replace('http://', '', "${serverUrl}");
					list($host, $port) = explode(':', $url);

					// Send a request via a stream_socket_client()
					$handle = stream_socket_client("tcp://$host:$port", $errno, $errstr, 1);
					stream_set_blocking($handle, false);
					while(true) {
						$write = [$handle];
						$read = [];
						$except = [];
						$result = stream_select($read, $write, $except, 1);
						if ($result > 0 && count($write) > 0) {
							// Socket is ready for writing
							break;
						}
					}
					$request = "GET / HTTP/1.1".chr(13).chr(10);
					$request .= "Host: $host".chr(13).chr(10);
					$request .= "Connection: close".chr(13).chr(10);
					$request .= chr(13).chr(10);
					fwrite($handle, $request);

					// Read the response
					$content = '';
					while(true) {
						$read = [$handle];
						$write = [];
						$except = [];
						$result = stream_select($read, $write, $except, 1);
						if ($result > 0 && count($read) > 0) {
							$content .= fread($handle, 8192);
							if(strlen($content) !== 0) {
								break;
							}
						}
					}

					// We have the response now, which should be just "response from express".
					// Let's confirm that:
					if (substr($content, -strlen('response from express')) !== 'response from express') {
						throw new Exception('Response is "'.$content.'". Expected: "response from express"');
					}

					// Okay, the response is fully received. Now the actual test:
					// stream_select() should return 1 even if we only ask for POLLIN:
					$read = [$handle];
					$write = [];
					$except = [];
					$result = stream_select($read, $write, $except, 1);

					echo "Stream select result: $result\n";
					fclose($handle);
					`
				);
				const { text } = await php.run({
					scriptPath: '/tmp/test.php',
				});
				expect(text).toContain('Stream select result: 1');
			} finally {
				php?.exit();
				await stopServer(server);
			}
		}, 10000);

		describe('cURL', () => {
			if (phpVersion === '8.6') {
				it('verifies a local HTTPS server certificate', async () => {
					let php: PHP | undefined;
					try {
						const certificate = readFileSync(
							new URL('./test-data/cert.pem', import.meta.url)
						);
						server = https.createServer(
							{
								cert: certificate,
								key: readFileSync(
									new URL(
										'./test-data/key.pem',
										import.meta.url
									)
								),
							},
							(_req, res) => res.end('secure response')
						);
						await new Promise<void>((resolve) =>
							server.listen(0, resolve)
						);
						const serverUrl = `https://127.0.0.1:${server.address().port}`;
						php = new PHP(
							await loadNodeRuntime(phpVersion, options)
						);
						await setPhpIniEntries(php, { disable_functions: '' });
						php.writeFile('/tmp/test-ca.pem', certificate);
						php.writeFile(
							'/tmp/public-cas.pem',
							rootCertificates.join('\n')
						);
						const response = await php.run({
							code: `<?php
								$untrusted = curl_init('${serverUrl}');
								curl_setopt($untrusted, CURLOPT_RETURNTRANSFER, true);
								curl_setopt($untrusted, CURLOPT_CAINFO, '/tmp/public-cas.pem');
								curl_exec($untrusted);
								$untrustedError = curl_errno($untrusted);
								$curl = curl_init('${serverUrl}');
								curl_setopt($curl, CURLOPT_CAINFO, '/tmp/test-ca.pem');
								curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
								$body = curl_exec($curl);
								if ($body === false) {
									throw new Exception(curl_error($curl));
								}
								echo json_encode(['body' => $body, 'untrusted_error' => $untrustedError]);
							`,
						});
						expect(JSON.parse(response.text)).toEqual({
							body: 'secure response',
							untrusted_error: 60,
						});
					} finally {
						php?.exit();
						await stopServer(server);
					}
				}, 15000);

				it('reports the delivered response size', async () => {
					let php: PHP | undefined;
					try {
						const body = 'response from express'.repeat(10);
						const compressed = gzipSync(body);
						server = http.createServer((_req, res) => {
							res.writeHead(200, {
								'Content-Encoding': 'gzip',
								'Content-Length': compressed.length,
							});
							res.end(compressed);
						});
						await new Promise<void>((resolve) =>
							server.listen(0, resolve)
						);
						const serverUrl = `http://127.0.0.1:${server.address().port}`;
						php = new PHP(
							await loadNodeRuntime(phpVersion, options)
						);
						await setPhpIniEntries(php, {
							disable_functions: '',
						});
						const response = await php.run({
							code: `<?php
								$curl = curl_init('${serverUrl}');
								curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
								curl_setopt($curl, CURLOPT_ENCODING, '');
								$body = curl_exec($curl);
								$info = curl_getinfo($curl);
								echo json_encode([
									'length' => strlen($body),
									'downloaded' => curl_getinfo($curl, CURLINFO_SIZE_DOWNLOAD_T),
									'by_constant' => curl_getinfo($curl, CURLINFO_SIZE_DELIVERED),
									'by_array' => $info['size_delivered'],
								]);
							`,
						});
						expect(JSON.parse(response.text)).toEqual({
							length: body.length,
							downloaded: compressed.length,
							by_constant: body.length,
							by_array: body.length,
						});
					} finally {
						php?.exit();
						await stopServer(server);
					}
				}, 10000);

				it('authenticates with an NTLM challenge', async () => {
					let php: PHP | undefined;
					const messages: number[] = [];
					try {
						const challenge =
							'TlRMTVNTUAACAAAAAgACADAAAACGggEAc51AYVDgyNcAAAAAAAAAAG4AbgAyAAAAQ0MCAAQAQwBDAAEAEgBFAEwASQBTAEEAQgBFAFQASAAEABgAYwBjAC4AaQBjAGUAZABlAHYALgBuAHUAAwAsAGUAbABpAHMAYQBiAGUAdABoAC4AYwBjAC4AaQBjAGUAZABlAHYALgBuAHUAAAAAAA==';
						server = http.createServer((req, res) => {
							const authorization = req.headers.authorization;
							if (!authorization?.startsWith('NTLM ')) {
								res.writeHead(401, {
									'WWW-Authenticate': 'NTLM',
								});
							} else {
								const message = Buffer.from(
									authorization.slice(5),
									'base64'
								).readUInt32LE(8);
								messages.push(message);
								if (message === 1) {
									res.writeHead(401, {
										'WWW-Authenticate': `NTLM ${challenge}`,
									});
								} else if (message === 3) {
									res.end('authenticated');
									return;
								} else {
									res.writeHead(400);
								}
							}
							res.end();
						});
						await new Promise<void>((resolve) =>
							server.listen(0, resolve)
						);
						php = new PHP(
							await loadNodeRuntime(phpVersion, options)
						);
						await setPhpIniEntries(php, { disable_functions: '' });
						const response = await php.run({
							code: `<?php
								$curl = curl_init('http://127.0.0.1:${server.address().port}');
								curl_setopt_array($curl, [
									CURLOPT_HTTPAUTH => CURLAUTH_NTLM,
									CURLOPT_USERPWD => 'user:password',
									CURLOPT_RETURNTRANSFER => true,
									CURLOPT_TIMEOUT => 4,
								]);
								$body = curl_exec($curl);
								if ($body === false) {
									throw new Exception(curl_error($curl));
								}
								echo $body;
							`,
						});
						expect(response.text).toBe('authenticated');
						expect(messages).toEqual([1, 3]);
					} finally {
						php?.exit();
						await stopServer(server);
					}
				}, 10000);

				it('rewinds a streamed upload on redirect', async () => {
					let php: PHP | undefined;
					try {
						const serverUrl = await startRedirectUploadServer();
						php = new PHP(
							await loadNodeRuntime(phpVersion, options)
						);
						await setPhpIniEntries(php, {
							disable_functions: '',
						});
						const response = await php.run({
							code: `<?php
								$stream = fopen('php://temp', 'r+');
								fwrite($stream, 'upload body');
								rewind($stream);
								$seeks = 0;
								$curl = curl_init('${serverUrl}/redirect');
								curl_setopt_array($curl, [
									CURLOPT_UPLOAD => true,
									CURLOPT_INFILE => $stream,
									CURLOPT_INFILESIZE => 11,
									CURLOPT_TIMEOUT => 4,
									CURLOPT_HTTPHEADER => ['Expect:'],
									CURLOPT_FOLLOWLOCATION => true,
									CURLOPT_RETURNTRANSFER => true,
									CURLOPT_SEEKFUNCTION => function ($handle, $offset, $origin) use ($stream, &$seeks) {
										$seeks++;
										return fseek($stream, $offset, $origin) === 0 ? CURL_SEEKFUNC_OK : CURL_SEEKFUNC_FAIL;
									},
								]);
								$body = curl_exec($curl);
								echo json_encode(['body' => $body, 'rewound' => $seeks > 0]);
							`,
						});
						expect(JSON.parse(response.text)).toEqual({
							body: 'upload body',
							rewound: true,
						});
					} finally {
						php?.exit();
						await stopServer(server);
					}
				}, 10000);
			}

			it('should support single handle requests', async () => {
				let php: PHP | undefined;
				try {
					const serverUrl = await startServer();
					php = new PHP(await loadNodeRuntime(phpVersion, options));
					await setPhpIniEntries(php, {
						allow_url_fopen: 1,
						disable_functions: '',
					});
					php.writeFile(
						'/tmp/test.php',
						`<?php
							$ch = curl_init();
							curl_setopt($ch, CURLOPT_URL, "${serverUrl}");
							curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
							curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
							echo curl_exec($ch);
					`
					);
					const { text } = await php.run({
						scriptPath: '/tmp/test.php',
					});
					expect(text).toEqual('response from express');
				} finally {
					php?.exit();
					await stopServer(server);
				}
			});

			it(
				'should support multi handle requests',
				async () => {
					let php: PHP | undefined;
					try {
						const serverUrl = await startServer();
						php = new PHP(
							await loadNodeRuntime(phpVersion, options)
						);
						await setPhpIniEntries(php, {
							allow_url_fopen: 1,
							disable_functions: '',
						});
						php.writeFile(
							'/tmp/test.php',
							`<?php
							$ch1 = curl_init();
							curl_setopt($ch1, CURLOPT_URL, "${serverUrl}");
							curl_setopt($ch1, CURLOPT_TCP_NODELAY, 0);
							curl_setopt($ch1, CURLOPT_RETURNTRANSFER, 1);
							$ch2 = curl_init();
							curl_setopt($ch2, CURLOPT_URL, "${serverUrl}");
							curl_setopt($ch2, CURLOPT_TCP_NODELAY, 0);
							curl_setopt($ch2, CURLOPT_RETURNTRANSFER, 1);
							$mh = curl_multi_init();
							curl_multi_add_handle($mh, $ch1);
							curl_multi_add_handle($mh, $ch2);
							$started = microtime(true);
							do {
								$status = curl_multi_exec($mh, $running);
								if ($status !== CURLM_OK && $status !== CURLM_CALL_MULTI_PERFORM) {
									throw new Exception('curl_multi_exec failed: '.curl_multi_strerror($status));
								}
								if ($running > 0) {
									$rc = curl_multi_select($mh, 1.0);
									if ($rc === -1) {
										usleep(100000);
									}
								}
								if ((microtime(true) - $started) > 5) {
									throw new Exception('curl_multi_exec timed out');
								}
							} while ($running > 0);
							echo curl_multi_getcontent($ch1)."\\n";
							echo curl_multi_getcontent($ch2);
							curl_multi_remove_handle($mh, $ch1);
							curl_multi_remove_handle($mh, $ch2);
							curl_multi_close($mh);
					`
						);
						const { text } = await php.run({
							scriptPath: '/tmp/test.php',
						});
						expect(text).toEqual(
							'response from express\nresponse from express'
						);
					} finally {
						try {
							php?.exit();
						} catch {
							// ignore cleanup failures
						}
						await stopServer(server);
					}
				},
				{ timeout: 20_000 }
			);

			it('should follow redirects', async () => {
				try {
					const serverUrl = await startServer();
					const php = new PHP(
						await loadNodeRuntime(phpVersion, options)
					);
					await setPhpIniEntries(php, {
						allow_url_fopen: 1,
						disable_functions: '',
					});
					php.writeFile(
						'/tmp/test.php',
						`<?php
							$ch = curl_init();
							curl_setopt($ch, CURLOPT_URL, "${serverUrl}/redirect");
							curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
							curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
							echo curl_exec($ch);
					`
					);
					const { text } = await php.run({
						scriptPath: '/tmp/test.php',
					});
					php.exit();
					expect(text).toEqual('response from express');
				} finally {
					await stopServer(server);
				}
			});

			it(
				'should support HTTPS requests',
				async () => {
					const php = new PHP(
						await loadNodeRuntime(phpVersion, options)
					);
					await setPhpIniEntries(php, {
						'openssl.cafile': '/tmp/ca-bundle.crt',
						allow_url_fopen: 1,
						disable_functions: '',
						html_errors: 0,
					});
					php.writeFile(
						'/tmp/ca-bundle.crt',
						rootCertificates.join('\n')
					);
					const { text } = await php.run({
						code: `<?php
						$ch = curl_init();
						curl_setopt($ch, CURLOPT_URL, "https://api.wordpress.org/stats/php/1.0/");
						curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
						curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
						$result = curl_exec($ch);
						$json = json_decode($result, true);
						var_dump(array_key_exists('8.3', $json));
						`,
					});
					php.exit();
					expect(text).toContain('bool(true)');
				},
				{ timeout: 2000, retry: 4 }
			);

			it(
				'should support HTTPS requests when certificate verification is disabled',
				async () => {
					const php = new PHP(
						await loadNodeRuntime(phpVersion, options)
					);
					await setPhpIniEntries(php, {
						allow_url_fopen: 1,
						disable_functions: '',
						html_errors: 0,
					});
					const { text } = await php.run({
						code: `<?php
						$ch = curl_init();
						curl_setopt($ch, CURLOPT_URL, "https://api.wordpress.org/stats/php/1.0/");
						curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
						curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
						curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
						curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
						$result = curl_exec($ch);
						$json = json_decode($result, true);
						var_dump(array_key_exists('8.3', $json));
						`,
					});
					php.exit();
					expect(text).toContain('bool(true)');
				},
				{ timeout: 2000, retry: 4 }
			);

			it(
				'should support CURLFile uploads',
				async () => {
					let php: PHP | undefined;
					try {
						const serverUrl = await startUploadServer();
						php = new PHP(
							await loadNodeRuntime(phpVersion, options)
						);
						await setPhpIniEntries(php, {
							allow_url_fopen: 1,
							disable_functions: '',
						});
						php.writeFile(
							'/tmp/upload.txt',
							'Hello from CURLFile!'
						);
						php.writeFile(
							'/tmp/test.php',
							`<?php
							$ch = curl_init();
							curl_setopt($ch, CURLOPT_URL, "${serverUrl}/upload");
							curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
							curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
							curl_setopt($ch, CURLOPT_POST, 1);
							$file = new CURLFile('/tmp/upload.txt', 'text/plain', 'upload.txt');
							curl_setopt($ch, CURLOPT_POSTFIELDS, [
								'myfile' => $file,
								'field1' => 'value1'
							]);
							$result = curl_exec($ch);
							if ($result === false) {
								echo 'CURL ERROR: ' . curl_error($ch);
							} else {
								echo $result;
							}
						`
						);
						const { text } = await php.run({
							scriptPath: '/tmp/test.php',
						});
						expect(text).toContain('Hello from CURLFile!');
						expect(text).toContain('multipart/form-data');
						expect(text).toContain('value1');
					} finally {
						php?.exit();
						await stopServer(server);
					}
				},
				{ timeout: 15000 }
			);

			it('should close server when runtime is exited', async () => {
				const id = await loadNodeRuntime(phpVersion, options);
				const rt = popLoadedRuntime(id, {
					dangerouslyKeepTheRuntimeInTheMap: true,
				});
				const php = new PHP(id);

				expect(rt.outboundNetworkProxyServer).toBeDefined();
				expect(rt.outboundNetworkProxyServer).toBeInstanceOf(
					http.Server
				);
				expect(rt.outboundNetworkProxyServer.listening).toBe(true);
				php.exit();

				// Wait for the server to close
				await new Promise((resolve) => {
					rt.outboundNetworkProxyServer.on('close', resolve);
				});

				expect(rt.outboundNetworkProxyServer.listening).toBe(false);
			});
		});
	});
});
