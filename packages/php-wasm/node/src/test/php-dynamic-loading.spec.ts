import { loadNodeRuntime } from '..';
import { DEFAULT_IDE_KEY } from '@php-wasm/cli-util';
import {
	PHP,
	proxyFileSystem,
	setPhpIniEntries,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import { createServer, type AddressInfo } from 'net';
import { jspi } from 'wasm-feature-detect';

// Check JSPI availability at module load time (top-level await)
// so the value is available when tests are registered.
const isJspiAvailable = await jspi();

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;
describe.each(phpVersions)('PHP %s', (phpVersion) => {
	describe('XDebug', () => {
		let php: PHP;
		const isPHP85orHigher =
			SupportedPHPVersionsList.indexOf(phpVersion) <=
			SupportedPHPVersions.indexOf('8.5');
		beforeEach(async () => {
			const options = isPHP85orHigher
				? {
						pathMappings: [
							{ hostPath: '/foo/', vfsPath: '/bar/baz/' },
						],
						pathSkippings: ['/baz/', '/qux.php'],
					}
				: true;

			php = new PHP(
				await loadNodeRuntime(phpVersion as any, {
					withXdebug: options,
				})
			);
		});

		afterEach(async () => {
			php.exit();
		});

		it('does not load dynamically by default', async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));

			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('xdebug'));`,
			});

			expect(await result.stdoutText).toEqual('bool(false)\n');
		});

		it('supports dynamic loading', async () => {
			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('xdebug'));`,
			});

			expect(await result.stdoutText).toEqual(
				[
					"<pre class='xdebug-var-dump' dir='ltr'>",
					"<small>/internal/eval.php:2:</small><small>boolean</small> <font color='#75507b'>true</font>",
					'</pre>',
				].join('\n')
			);
		});

		it('has its own ini file and entries', async () => {
			const entries = php.readFileAsText(
				'/internal/shared/extensions/xdebug.ini'
			);

			const expected = [
				'zend_extension=/internal/shared/extensions/xdebug.so',
				'xdebug.mode=debug,develop',
				'xdebug.start_with_request=yes',
				`xdebug.idekey="${DEFAULT_IDE_KEY}"`,
				'xdebug.path_mapping=yes',
			].join('\n');

			expect(entries).toEqual(expected);
		});

		it(
			'handles path mapping and path skipping',
			{ skip: !isPHP85orHigher },
			async () => {
				const pathMappings = php.readFileAsText('/.xdebug/path.map');
				const pathSkippings = php.readFileAsText('/.xdebug/skip.map');

				expect(pathMappings).toEqual('/bar/baz/ = /foo/');
				expect(pathSkippings).toEqual(
					['/baz/ = SKIP', '/qux.php = SKIP'].join('\n')
				);
			}
		);

		it('communicates with a DBGP client', { timeout: 20_000 }, async () => {
			/**
			 * Use an ephemeral port to avoid collisions with any stray/debugger
			 * processes that may already be listening on the default 9003.
			 * We still verify the full DBGP handshake, only the port is made
			 * deterministic per-test to remove flakiness.
			 */
			const queries = [
				'feature_set -i 1 -n resolved_breakpoints -v 1',
				'feature_set -i 2 -n notify_ok -v 1',
				'feature_set -i 3 -n extended_properties -v 1',
				'feature_set -i 4 -n breakpoint_include_return_value -v 1',
				'feature_set -i 5 -n max_children -v 100',
				'run -i 6',
				'stop -i 7',
			];

			let responses = '';
			let i = 0;
			let stopped = false;

			const server = createServer();

			try {
				// Start the server on an available port.
				await new Promise<void>((resolve, reject) => {
					server.once('error', reject);
					server.listen(0, '127.0.0.1', resolve);
				});
				const { port } = server.address() as AddressInfo;

				// Point Xdebug at the chosen port/host.
				await setPhpIniEntries(php, {
					'xdebug.client_port': port,
					'xdebug.client_host': '127.0.0.1',
				});

				const handshake = new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(
							new Error(
								'Xdebug did not complete the DBGP handshake in time'
							)
						);
					}, 8000);

					server.on('connection', (tcpSource) => {
						tcpSource.on('data', (data) => {
							if (queries[i]) {
								responses += new TextDecoder().decode(data);
								const payload = `${Buffer.byteLength(
									queries[i]
								)}\x00${queries[i]}\x00`;
								tcpSource.write(
									new TextEncoder().encode(payload)
								);
								i++;
							} else if (!stopped) {
								stopped = true;
								clearTimeout(timeout);
								resolve();
							}
						});
					});

					server.once('error', (err) => {
						clearTimeout(timeout);
						reject(err);
					});
					server.once('close', () => clearTimeout(timeout));
				});

				const result = await php.runStream({
					code: `<?php
					echo "Hello Xdebug World";`,
				});

				await handshake;

				expect(responses).toContain(
					'<init xmlns="urn:debugger_protocol_v1"'
				);
				expect(responses).toContain('success="1"></response>');

				expect(await result.stdoutText).toEqual('Hello Xdebug World');
			} finally {
				// Ensure the port is always freed for subsequent PHP versions.
				if (server.listening) {
					await new Promise((resolve) => server.close(resolve));
				}
			}
		});
	});

	describe('Intl', () => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, { withIntl: true })
			);
		});

		afterEach(async () => {
			php.exit();
		});

		it('does not load dynamically by default', async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));

			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('intl'));
					var_dump(class_exists('Collator'));`,
			});

			expect(await result.stdoutText).toEqual(
				'bool(false)\nbool(false)\n'
			);
		});

		it('supports dynamic loading', async () => {
			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('intl'));
					var_dump(class_exists('Collator'));`,
			});

			expect(await result.stdoutText).toEqual('bool(true)\nbool(true)\n');
		});

		it('has its own ini file and entries', async () => {
			const entries = php.readFileAsText(
				'/internal/shared/extensions/intl.ini'
			);

			const expected = [
				'extension=/internal/shared/extensions/intl.so',
			].join('\n');

			expect(entries).toEqual(expected);
		});

		it('loads the icu data file', async () => {
			/*
			 * The Intl extension is hard-coded to look for the `icudt74l` filename,
			 * which means the ICU data file must use that exact name.
			 */
			expect(php.listFiles('/internal/shared')).toContain('icudt74l.dat');
		});

		it('reads the icu data in PROXYFS', async () => {
			const newPhp = new PHP(
				await loadNodeRuntime(phpVersion as any, {
					withIntl: true,
				})
			);

			await proxyFileSystem(php, newPhp, ['/internal/shared']);

			const response = await newPhp.runStream({
				code: `<?php
						$data = array(
							'F' => 'Foo',
							'Br' => 'Bar',
							'Bz' => 'Bz',
						);

						$collator = new Collator('en_US');
						$collator->asort($data, Collator::SORT_STRING);
						var_dump($data);
					?>`,
			});

			newPhp.exit();

			expect(await response.stdoutText).toEqual(
				'array(3) {\n  ["Br"]=>\n  string(3) "Bar"\n  ["Bz"]=>\n  string(2) "Bz"\n  ["F"]=>\n  string(3) "Foo"\n}\n'
			);
		});

		it('uses intl functions', async () => {
			const response = await php.runStream({
				code: `<?php
						$formatter = numfmt_create('en-US', NumberFormatter::CURRENCY);
						echo numfmt_format($formatter, 100.00);
						$formatter = numfmt_create('fr-FR', NumberFormatter::CURRENCY);
						echo numfmt_format($formatter, 100.00);
					?>`,
			});
			expect(await response.stdoutText).toEqual('$100.00100,00\xA0€');
		});

		it('uses intl classes', async () => {
			const response = await php.runStream({
				code: `<?php
						$data = array(
							'F' => 'Foo',
							'Br' => 'Bar',
							'Bz' => 'Bz',
						);

						$collator = new Collator('en_US');
						$collator->asort($data, Collator::SORT_STRING);
						var_dump($data);
					?>`,
			});
			expect(await response.stdoutText).toEqual(
				'array(3) {\n  ["Br"]=>\n  string(3) "Bar"\n  ["Bz"]=>\n  string(2) "Bz"\n  ["F"]=>\n  string(3) "Foo"\n}\n'
			);
		});
	});

	// Redis requires JSPI for proper exception handling during network operations.
	// Skip these tests when JSPI is not available (e.g., when running with asyncify).
	describe('Redis', () => {
		let php: PHP;
		beforeEach(async () => {
			if (!isJspiAvailable) {
				return;
			}
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, { withRedis: true })
			);
		});

		afterEach(async () => {
			if (php) {
				php.exit();
			}
		});

		it.skipIf(!isJspiAvailable)(
			'does not load dynamically by default',
			async () => {
				php = new PHP(await loadNodeRuntime(phpVersion as any));

				const result = await php.runStream({
					code: `<?php
					var_dump(extension_loaded('redis'));
					var_dump(class_exists('Redis'));`,
				});

				expect(await result.stdoutText).toEqual(
					'bool(false)\nbool(false)\n'
				);
			}
		);

		it.skipIf(!isJspiAvailable)('supports dynamic loading', async () => {
			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('redis'));
					var_dump(class_exists('Redis'));`,
			});

			expect(await result.stdoutText).toEqual('bool(true)\nbool(true)\n');
		});

		it.skipIf(!isJspiAvailable)(
			'has its own ini file and entries',
			async () => {
				const entries = php.readFileAsText(
					'/internal/shared/extensions/redis.ini'
				);

				const expected = [
					'extension=/internal/shared/extensions/redis.so',
				].join('\n');

				expect(entries).toEqual(expected);
			}
		);

		it.skipIf(!isJspiAvailable)('can instantiate Redis class', async () => {
			const result = await php.runStream({
				code: `<?php
					$redis = new Redis();
					var_dump(get_class($redis));`,
			});

			expect(await result.stdoutText).toEqual('string(5) "Redis"\n');
		});
	});

	// Memcached requires JSPI for proper exception handling during network operations.
	// Skip these tests when JSPI is not available (e.g., when running with asyncify).
	describe('Memcached', () => {
		let php: PHP;
		beforeEach(async () => {
			if (!isJspiAvailable) {
				return;
			}
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, {
					withMemcached: true,
				})
			);
		});

		afterEach(async () => {
			if (php) {
				php.exit();
			}
		});

		it.skipIf(!isJspiAvailable)(
			'does not load dynamically by default',
			async () => {
				php = new PHP(await loadNodeRuntime(phpVersion as any));

				const result = await php.runStream({
					code: `<?php
					var_dump(extension_loaded('memcached'));
					var_dump(class_exists('Memcached'));`,
				});

				expect(await result.stdoutText).toEqual(
					'bool(false)\nbool(false)\n'
				);
			}
		);

		it.skipIf(!isJspiAvailable)('supports dynamic loading', async () => {
			const result = await php.runStream({
				code: `<?php
					var_dump(extension_loaded('memcached'));
					var_dump(class_exists('Memcached'));`,
			});

			expect(await result.stdoutText).toEqual('bool(true)\nbool(true)\n');
		});

		it.skipIf(!isJspiAvailable)(
			'has its own ini file and entries',
			async () => {
				const entries = php.readFileAsText(
					'/internal/shared/extensions/memcached.ini'
				);

				const expected = [
					'extension=/internal/shared/extensions/memcached.so',
				].join('\n');

				expect(entries).toEqual(expected);
			}
		);

		it.skipIf(!isJspiAvailable)(
			'can instantiate Memcached class',
			async () => {
				const response = await php.runStream({
					code: `<?php
						$memcached = new Memcached();
						var_dump(get_class($memcached));
					?>`,
				});
				expect(await response.stdoutText).toEqual(
					'string(9) "Memcached"\n'
				);
			}
		);

		it.skipIf(!isJspiAvailable)(
			'has expected Memcached constants',
			async () => {
				const response = await php.runStream({
					code: `<?php
						echo defined('Memcached::OPT_COMPRESSION') ? 'true' : 'false';
						echo '|';
						echo defined('Memcached::OPT_SERIALIZER') ? 'true' : 'false';
						echo '|';
						echo defined('Memcached::HAVE_IGBINARY') ? 'true' : 'false';
					?>`,
				});
				expect(await response.stdoutText).toEqual('true|true|true');
			}
		);
	});
});
