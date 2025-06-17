import { loadNodeRuntime } from '..';
import { PHP, SupportedPHPVersions } from '@php-wasm/universal';
import path from 'path';
import fs from 'fs';

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

			const result = await php.run({
				code: `<?php
                    var_dump(extension_loaded('xdebug'));`,
			});

			expect(result.text).toEqual('bool(false)\n');
		});

		it('supports dynamic loading', async () => {
			const iniPath = '/internal/shared/extensions/xdebug.ini';
			const entries = php
				.readFileAsText(iniPath)
				.replace('xdebug.mode=debug,develop', 'xdebug.mode=off')
				.concat('\nhtml_errors=off');
			php.writeFile(iniPath, entries);

			const result = await php.run({
				code: `<?php
                    var_dump(extension_loaded('xdebug'));`,
			});

			expect(result.text).toEqual('bool(true)\n');
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
	});
});
