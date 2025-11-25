import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
	getLoadedRuntime,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import express from 'express';
import { rootCertificates } from 'tls';
import { loadNodeRuntime } from '../lib';
import type { PHPLoaderOptions } from '../lib';
import http from 'http';

const phpVersions =
	'PHP' in process.env
		? [process.env['PHP']! as SupportedPHPVersion]
		: SupportedPHPVersions;

const phpLoaderOptions: PHPLoaderOptions[] = [{}, { withXdebug: true }];

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
							curl_close($ch);
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
							curl_close($ch1);
							curl_close($ch2);
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
							curl_close($ch);
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
						curl_close($ch);
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
						curl_close($ch);
						$json = json_decode($result, true);
						var_dump(array_key_exists('8.3', $json));
						`,
					});
					php.exit();
					expect(text).toContain('bool(true)');
				},
				{ timeout: 2000, retry: 4 }
			);

			it('should close server when runtime is exited', async () => {
				const id = await loadNodeRuntime(phpVersion, options);
				const php = new PHP(id);
				const rt = getLoadedRuntime(id);

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
