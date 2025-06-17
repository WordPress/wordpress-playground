import { loadNodeRuntime } from '..';
import { PHP, SupportedPHPVersions } from '@php-wasm/universal';
import path from 'path';
import fs from 'fs';
import { createServer } from 'net';

vi.mock('path', async (originalPath) => ({
	...(await originalPath()),
	dirname: vi.fn((input) => path.resolve(input, '../../../../')),
}));

describe.each(SupportedPHPVersions)('PHP %s', (phpVersion) => {
	describe('XDebug', () => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, { withXdebug: true })
			);
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
			const iniPath = '/internal/shared/extensions/xdebug.ini';
			const entries = php
				.readFileAsText(iniPath)
				.replace('xdebug.mode=debug,develop', 'xdebug.mode=off')
				.concat('\nhtml_errors=off');
			php.writeFile(iniPath, entries);

			const result = await php.runStream({
				code: `<?php
                    var_dump(extension_loaded('xdebug'));`,
			});

			expect(await result.stdoutText).toEqual('bool(true)\n');
		});

		it('has its own ini file and entries', async () => {
			const entries = php.readFileAsText(
				'/internal/shared/extensions/xdebug.ini'
			);

			const expected = [
				'zend_extension=/internal/shared/extensions/xdebug.so',
				'xdebug.mode=debug,develop',
				'xdebug.start_with_request=yes',
				'xdebug.start_upon_error=yes',
			].join('\n');

			expect(entries).toEqual(expected);
		});

		it('mounts current working directory', async () => {
			expect(php.listFiles(process.cwd())).toEqual(
				fs.readdirSync(process.cwd())
			);
		});

		it('communicates with default DBGP port', async () => {
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

			server.on('connection', function handleConnection(tcpSource) {
				tcpSource.on('data', (data) => {
					if (queries[i]) {
						responses += new TextDecoder().decode(data);
						const payload = `${Buffer.byteLength(queries[i])}\x00${
							queries[i]
						}\x00`;
						tcpSource.write(new TextEncoder().encode(payload));
						i++;
					} else {
						stopped = true;
						server.close();
					}
				});
			});

			server.listen(9003);

			const result = await php.runStream({
				code: `<?php
					echo "Hello Xdebug World";`,
			});

			await vi.waitUntil(() => stopped, { timeout: 5000 });

			expect(responses).toContain(
				'<init xmlns="urn:debugger_protocol_v1"'
			);
			expect(responses).toContain('success="1"></response>');

			expect(await result.stdoutText).toEqual('Hello Xdebug World');
		});
	});
});
