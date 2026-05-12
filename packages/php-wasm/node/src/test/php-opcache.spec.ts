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

	it('uses the in-memory cache with file cache fallback', async () => {
		expect(php.readFileAsText('/internal/shared/php.ini')).toContain(
			'opcache.file_cache_only = 0'
		);
	});

	it('keeps file-cache-only mode for PHP versions older than 8.1', async () => {
		const php80 = new PHP(await loadNodeRuntime('8.0'));

		expect(php80.readFileAsText('/internal/shared/php.ini')).toContain(
			'opcache.file_cache_only = 1'
		);
	});

	it('uses the in-memory cache for PHP 8.1 and newer', async () => {
		const php81 = new PHP(await loadNodeRuntime('8.1'));

		expect(php81.readFileAsText('/internal/shared/php.ini')).toContain(
			'opcache.file_cache_only = 0'
		);
	});

	it('revalidates changed scripts', async () => {
		php.writeFile('/tmp/opcache-test.php', '<?php echo "first";');

		const firstResponse = await php.runStream({
			code: '<?php require "/tmp/opcache-test.php";',
		});

		expect(await firstResponse.stdoutText).toBe('first');

		php.writeFile('/tmp/opcache-test.php', '<?php echo "second";');

		const secondResponse = await php.runStream({
			code: '<?php require "/tmp/opcache-test.php";',
		});

		expect(await secondResponse.stdoutText).toBe('second');
	});
});
