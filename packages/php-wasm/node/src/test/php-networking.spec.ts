import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import express from 'express';
import { rootCertificates } from 'tls';
import { loadNodeRuntime } from '../lib';
import type { PHPLoaderOptions } from '../lib';
import net from 'net';

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
	async function stopServer(server: any) {
		if (server) {
			await new Promise((resolve) => {
				server.close(resolve);
			});
			server = undefined;
		}
	}

	phpLoaderOptions.forEach((options) => {
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
		});

		describe('Runtime exit', () => {
			it('should flush persistent and closed connections when the runtime exits', async () => {
				const size = 8 * 1024 * 1024;
				const tcpServer = net.createServer();
				const connections: net.Socket[] = [];
				const received: number[] = [];
				const ended: Promise<void>[] = [];
				const bothConnected = new Promise<void>((resolve) =>
					tcpServer.on('connection', (socket) => {
						const index = connections.length;
						connections.push(socket);
						received.push(0);
						// Keep writes queued until after the runtime exits.
						socket.pause();
						socket.write('ready');
						socket.on('data', (data) => {
							received[index] += data.length;
						});
						ended.push(
							new Promise((resolveEnd) =>
								socket.once('end', () => resolveEnd())
							)
						);
						if (connections.length === 2) {
							resolve();
						}
					})
				);
				await new Promise<void>((resolve) =>
					tcpServer.listen(0, '127.0.0.1', resolve)
				);
				const { port } = tcpServer.address() as net.AddressInfo;
				let php: PHP | undefined;
				try {
					php = new PHP(await loadNodeRuntime(phpVersion, options));
					const { text } = await php.run({
						code: `<?php
						$payload = str_repeat('x', ${size});
						$persistent = pfsockopen('127.0.0.1', ${port});
						$closed = fsockopen('127.0.0.1', ${port});
						// Wait for both TCP connections before writing and closing.
						fread($persistent, 5);
						fread($closed, 5);
						$written = [fwrite($persistent, $payload), fwrite($closed, $payload)];
						fclose($closed);
						echo json_encode($written);
						`,
					});
					await bothConnected;
					php.exit();
					connections.forEach((socket) => socket.resume());
					await Promise.all(ended);

					expect(JSON.parse(text)).toEqual([size, size]);
					expect(received).toEqual([size, size]);
				} finally {
					php?.exit();
					connections.forEach((socket) => socket.destroy());
					await new Promise((resolve) => tcpServer.close(resolve));
				}
			});
			it('should unref every connection when the runtime exits', async () => {
				// The server keeps its side open after the client closes, so a
				// connection the runtime doesn't unref would keep Node.js running.
				const tcpServer = net.createServer({ allowHalfOpen: true });
				const connections: net.Socket[] = [];
				const bothConnected = new Promise<void>((resolve) =>
					tcpServer.on('connection', (socket) => {
						socket.resume();
						socket.write('ready');
						connections.push(socket);
						if (connections.length === 2) {
							resolve();
						}
					})
				);
				await new Promise<void>((resolve) =>
					tcpServer.listen(0, '127.0.0.1', resolve)
				);
				const { port } = tcpServer.address() as net.AddressInfo;
				let php: PHP | undefined;
				try {
					php = new PHP(await loadNodeRuntime(phpVersion, options));
					// Wait for both TCP connections. The runtime destroys a
					// socket that's still connecting at exit instead of unrefing it.
					await php.run({
						code: `<?php
						$persistent = pfsockopen('127.0.0.1', ${port});
						$closed = fsockopen('127.0.0.1', ${port});
						fread($persistent, 5);
						fread($closed, 5);
						fclose($closed);
						`,
					});
					await bothConnected;
					// Record the local port of each socket the runtime unrefs. The
					// server sees it as the connection's remotePort.
					const unrefedPorts = new Set<number | undefined>();
					const unref = net.Socket.prototype.unref;
					const unrefSpy = vi
						.spyOn(net.Socket.prototype, 'unref')
						.mockImplementation(function (this: net.Socket) {
							if (!connections.includes(this)) {
								unrefedPorts.add(this.localPort);
							}
							return unref.apply(this);
						});
					try {
						php.exit();
					} finally {
						unrefSpy.mockRestore();
					}

					expect([...unrefedPorts].sort()).toEqual(
						connections.map((socket) => socket.remotePort).sort()
					);
				} finally {
					php?.exit();
					connections.forEach((socket) => socket.destroy());
					tcpServer.close();
				}
			});

			it.each([false, true])(
				'should not resume PHP after exit (finite read timeout: %s)',
				async (finiteTimeout) => {
					const tcpServer = net.createServer({ allowHalfOpen: true });
					const connections: net.Socket[] = [];
					const waiting = new Promise<void>((resolve) =>
						tcpServer.on('connection', (socket) => {
							connections.push(socket);
							socket.once('data', () => resolve());
						})
					);
					await new Promise<void>((resolve) =>
						tcpServer.listen(0, '127.0.0.1', resolve)
					);
					const { port } = tcpServer.address() as net.AddressInfo;
					let php: PHP | undefined;
					try {
						php = new PHP(
							await loadNodeRuntime(phpVersion, options)
						);
						let output: string | undefined;
						let failure: unknown;
						php.run({
							code: `<?php
						$socket = fsockopen('127.0.0.1', ${port});
						${finiteTimeout ? 'stream_set_timeout($socket, 0, 100000);' : ''}
						fwrite($socket, 'waiting');
						fread($socket, 1);
						echo 'continued after exit';
						fsockopen('127.0.0.1', ${port});
						`,
						}).then(
							(result) => (output = result.text),
							(error) => (failure = error)
						);
						// PHP is waiting in fread() once its write arrives.
						await waiting;
						const ended = new Promise((resolve) =>
							connections[0].once('end', resolve)
						);
						php.exit();
						await ended;
						// Wait beyond the finite read timeout as well as queued close events.
						await new Promise((resolve) =>
							setTimeout(resolve, 250)
						);

						expect(connections).toHaveLength(1);
						expect(output ?? '').toBe('');
						expect(failure).toBeUndefined();
					} finally {
						php?.exit();
						connections.forEach((socket) => socket.destroy());
						tcpServer.close();
					}
				}
			);
		});

		describe('Listening sockets', () => {
			it('should accept a connection and report the real peer address', async () => {
				const port = await getUnusedPort();
				const php = new PHP(await loadNodeRuntime(phpVersion, options));
				let clientPort = 0;
				let received = '';
				let phpFinished = false;
				// PHP's server starts during php.run(), so retry until it listens
				// or PHP stops waiting for a connection.
				const client = (async () => {
					while (!phpFinished) {
						try {
							await new Promise<void>((resolve, reject) => {
								const socket = net.connect(port, '127.0.0.1');
								socket.once('error', reject);
								socket.once('connect', () => {
									clientPort = socket.localPort!;
									socket.write('hello from node');
								});
								socket.on('data', (data) => (received += data));
								socket.once('close', () => resolve());
							});
							return;
						} catch {
							await new Promise((resolve) =>
								setTimeout(resolve, 20)
							);
						}
					}
				})();
				try {
					const { text } = await php.run({
						code: `<?php
						$server = stream_socket_server("tcp://127.0.0.1:${port}");
						$start = microtime(true);
						$connection = false;
						// stream_select() reports the server ready as soon as a client
						// connects, before its data arrives. Pause so the data is there
						// before accepting: with Asyncify, PHP crashes if
						// stream_socket_accept() has to wait. See
						// https://github.com/WordPress/wordpress-playground/issues/4576.
						while (!$connection && microtime(true) - $start < 10) {
							$read = [$server];
							$write = $except = null;
							if (stream_select($read, $write, $except, 0, 100000)) {
								usleep(50000);
								$connection = stream_socket_accept($server, 0, $peer);
							} else {
								usleep(10000);
							}
						}
						$data = fread($connection, 100);
						fwrite($connection, 'hello from php');
						fclose($connection);
						fclose($server);
						echo json_encode(['data' => $data, 'peer' => $peer]);
						`,
					});
					phpFinished = true;
					await client;
					const { data, peer } = JSON.parse(text);
					expect(data).toBe('hello from node');
					expect(peer).toBe(`127.0.0.1:${clientPort}`);
					expect(received).toBe('hello from php');
				} finally {
					phpFinished = true;
					php.exit();
				}
			}, 15000);
		});

		describe('Connection failures', () => {
			it('should fail promptly when cURL connects to a closed port', async () => {
				const port = await getUnusedPort();
				const php = new PHP(await loadNodeRuntime(phpVersion, options));
				try {
					const { text } = await php.run({
						code: `<?php
						$ch = curl_init("http://127.0.0.1:${port}/");
						curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
						curl_setopt($ch, CURLOPT_TIMEOUT, 10);
						$start = microtime(true);
						$result = curl_exec($ch);
						echo json_encode([
							'result' => $result,
							'errno' => curl_errno($ch),
							'seconds' => microtime(true) - $start,
						]);
						`,
					});
					const { result, errno, seconds } = JSON.parse(text);
					expect(result).toBe(false);
					// 28 is CURLE_OPERATION_TIMEDOUT.
					expect(errno).not.toBe(28);
					expect(seconds).toBeLessThan(5);
				} finally {
					php.exit();
				}
			});

			it('should read the data and the end of the stream when the peer resets the connection', async () => {
				const tcpServer = net.createServer((socket) => {
					socket.write('partial');
					setTimeout(() => socket.resetAndDestroy(), 50);
				});
				await new Promise<void>((resolve) =>
					tcpServer.listen(0, '127.0.0.1', resolve)
				);
				const { port } = tcpServer.address() as net.AddressInfo;
				const php = new PHP(await loadNodeRuntime(phpVersion, options));
				try {
					const { text } = await php.run({
						code: `<?php
						$start = microtime(true);
						$socket = fsockopen('127.0.0.1', ${port});
						$data = '';
						while (!feof($socket) && microtime(true) - $start < 10) {
							$chunk = fread($socket, 100);
							if ($chunk === false) {
								break;
							}
							$data .= $chunk;
						}
						echo json_encode([
							'data' => $data,
							'eof' => feof($socket),
							'seconds' => microtime(true) - $start,
						]);
						`,
					});
					const { data, eof, seconds } = JSON.parse(text);
					expect(data).toBe('partial');
					expect(eof).toBe(true);
					expect(seconds).toBeLessThan(5);
				} finally {
					php.exit();
					tcpServer.close();
				}
			});
		});
	});
});

async function getUnusedPort() {
	const server = net.createServer();
	await new Promise<void>((resolve) =>
		server.listen(0, '127.0.0.1', resolve)
	);
	const { port } = server.address() as net.AddressInfo;
	await new Promise((resolve) => server.close(resolve));
	return port;
}
