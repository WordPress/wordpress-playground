import { loadNodeRuntime } from '..';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
import fs from 'fs';
import { createServer, type AddressInfo } from 'net';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;
describe.each(phpVersions)('PHP %s', async (phpVersion) => {
	describe('XDebug', () => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, { withXdebug: true })
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
				'xdebug.idekey="PLAYGROUNDCLI"',
			].join('\n');

			expect(entries).toEqual(expected);
		});

		it('mounts current working directory', async () => {
			expect(php.listFiles(process.cwd())).toEqual(
				fs.readdirSync(process.cwd())
			);
		});

		it(
			'communicates with a DBGP client',
			async () => {
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

					expect(await result.stdoutText).toEqual(
						'Hello Xdebug World'
					);
				} finally {
					// Ensure the port is always freed for subsequent PHP versions.
					if (server.listening) {
						await new Promise((resolve) => server.close(resolve));
					}
				}
			},
			{ timeout: 20_000 }
		);
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
			expect(php.listFiles('/internal/shared')).toContain('icudt74l.dat');
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
});
