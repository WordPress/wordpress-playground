import { LatestSupportedPHPVersion, PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

describe('PHP OPcache', () => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(LatestSupportedPHPVersion));
	});

	it('should be loaded', async () => {
		const response = await php.runStream({
			code: '<?php echo json_encode(get_loaded_extensions());',
		});

		const loadedExtensions = JSON.parse(await response.stdoutText);
		expect(loadedExtensions).toContain('Zend OPcache');
	});

	it('is enabled in CLI', async () => {
		const response = await php.runStream({
			code: '<?php phpinfo();',
		});

		expect(await response.stdoutText).toContain(
			'<td class="e">Opcode Caching </td><td class="v">Up and Running </td>'
		);
	});
});
