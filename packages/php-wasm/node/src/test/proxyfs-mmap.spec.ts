import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
	PHP,
	proxyFileSystem,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import { SupportedPHPVersions } from '@php-wasm/universal';
import { createNodeFsMountHandler, loadNodeRuntime } from '../lib';

const phpVersionsToTest =
	'PHP' in process.env
		? [process.env['PHP']! as SupportedPHPVersion]
		: SupportedPHPVersions;

/**
 * These tests verify that PROXYFS properly supports mmap operations.
 *
 * PROXYFS proxies filesystem operations from one Emscripten FS instance to another,
 * enabling file sharing between PHP instances. Without mmap support, libraries like
 * ICU (used by the Intl extension) fail because they rely on memory-mapping data files.
 *
 * See: https://github.com/WordPress/wordpress-playground/pull/3073
 */
describe.each(phpVersionsToTest)('PHP %s: PROXYFS mmap', (phpVersion) => {
	const vfsMountPoint = '/test';

	let tempDir: string;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), 'php-wasm-proxyfs-mmap-'));
	});

	afterEach(async () => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	async function createPhpWithTestMount(): Promise<PHP> {
		const runtimeId = await loadNodeRuntime(phpVersion);
		const php = new PHP(runtimeId);
		php.mount(vfsMountPoint, createNodeFsMountHandler(tempDir));
		return php;
	}

	describe('mmap via PROXYFS', () => {
		it('should read file contents through PROXYFS using file_get_contents', async () => {
			// This test verifies that basic file reading works through PROXYFS,
			// which exercises the underlying read operations that mmap depends on.
			const testContent = 'Hello from PROXYFS!';
			writeFileSync(join(tempDir, 'test.txt'), testContent);

			using php1 = await createPhpWithTestMount();
			using php2 = new PHP(await loadNodeRuntime(phpVersion));

			// Mount PROXYFS on php2, pointing to php1's filesystem
			await proxyFileSystem(php1, php2, [vfsMountPoint]);

			const result = await php2.run({
				code: `<?php
					$content = file_get_contents('${vfsMountPoint}/test.txt');
					echo $content;
				`,
			});

			expect(result.exitCode).toBe(0);
			expect(result.text).toBe(testContent);
		});

		it('should read binary files through PROXYFS', async () => {
			// Binary file reading is important for mmap as ICU data files are binary.
			const binaryData = Buffer.from([
				0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd,
			]);
			writeFileSync(join(tempDir, 'binary.dat'), binaryData);

			using php1 = await createPhpWithTestMount();
			using php2 = new PHP(await loadNodeRuntime(phpVersion));

			await proxyFileSystem(php1, php2, [vfsMountPoint]);

			const result = await php2.run({
				code: `<?php
					$content = file_get_contents('${vfsMountPoint}/binary.dat');
					// Output bytes as hex
					echo bin2hex($content);
				`,
			});

			expect(result.exitCode).toBe(0);
			expect(result.text).toBe('00010203fffefd');
		});

		it('should read large files through PROXYFS', async () => {
			// Larger files test the mmap implementation's ability to handle
			// multi-byte reads that span memory pages.
			const largeContent = 'x'.repeat(1024 * 100); // 100KB
			writeFileSync(join(tempDir, 'large.txt'), largeContent);

			using php1 = await createPhpWithTestMount();
			using php2 = new PHP(await loadNodeRuntime(phpVersion));

			await proxyFileSystem(php1, php2, [vfsMountPoint]);

			const result = await php2.run({
				code: `<?php
					$content = file_get_contents('${vfsMountPoint}/large.txt');
					echo strlen($content);
				`,
			});

			expect(result.exitCode).toBe(0);
			expect(result.text).toBe(String(largeContent.length));
		});

		it('should read file at specific position through PROXYFS', async () => {
			// This tests partial file reading which is related to mmap with position offset.
			const testContent = 'ABCDEFGHIJ';
			writeFileSync(join(tempDir, 'position.txt'), testContent);

			using php1 = await createPhpWithTestMount();
			using php2 = new PHP(await loadNodeRuntime(phpVersion));

			await proxyFileSystem(php1, php2, [vfsMountPoint]);

			const result = await php2.run({
				code: `<?php
					$fp = fopen('${vfsMountPoint}/position.txt', 'r');
					fseek($fp, 3);
					$content = fread($fp, 4);
					fclose($fp);
					echo $content;
				`,
			});

			expect(result.exitCode).toBe(0);
			expect(result.text).toBe('DEFG');
		});

		it('should allow both PHP instances to read the same file simultaneously', async () => {
			// This tests concurrent access through PROXYFS, which is important
			// for understanding how mmap might behave with shared memory.
			const testContent = 'Shared content';
			writeFileSync(join(tempDir, 'shared.txt'), testContent);

			using php1 = await createPhpWithTestMount();
			using php2 = new PHP(await loadNodeRuntime(phpVersion));

			await proxyFileSystem(php1, php2, [vfsMountPoint]);

			const [result1, result2] = await Promise.all([
				php1.run({
					code: `<?php echo file_get_contents('${vfsMountPoint}/shared.txt');`,
				}),
				php2.run({
					code: `<?php echo file_get_contents('${vfsMountPoint}/shared.txt');`,
				}),
			]);

			expect(result1.exitCode).toBe(0);
			expect(result2.exitCode).toBe(0);
			expect(result1.text).toBe(testContent);
			expect(result2.text).toBe(testContent);
		});
	});
});

/**
 * These tests verify that ICU/Intl works through PROXYFS.
 *
 * The Intl extension relies on ICU, which uses mmap to load its data files.
 * Without proper mmap support in PROXYFS, ICU fails to initialize the Collator
 * class and other Intl functionality when the /internal/shared directory
 * (which contains the ICU data file) is accessed through PROXYFS.
 *
 * The proxyFileSystem() function now automatically adds mmap support to PROXYFS
 * at runtime, so these tests should pass without rebuilding PHP.
 *
 * See: https://github.com/WordPress/wordpress-playground/pull/3073
 */
describe.each(phpVersionsToTest)(
	'PHP %s: Intl extension via PROXYFS (mmap)',
	(phpVersion) => {
		it('should use Collator through PROXYFS', async () => {
			// Create php1 with Intl support - it has the ICU data file
			using php1 = new PHP(
				await loadNodeRuntime(phpVersion, { withIntl: true })
			);

			// Create php2 with Intl support
			using php2 = new PHP(
				await loadNodeRuntime(phpVersion, { withIntl: true })
			);

			// Mount PROXYFS on php2, sharing /internal/shared from php1.
			// This is where the ICU data file (icudt74l.dat) lives.
			// ICU uses mmap to read this file, so this tests that our
			// PROXYFS mmap implementation works correctly.
			// proxyFileSystem() automatically adds mmap support to PROXYFS.
			await proxyFileSystem(php1, php2, ['/internal/shared']);

			// Test that Collator works in php2 through PROXYFS.
			// This would fail without mmap support because ICU's uprv_mapFile
			// function uses mmap to load the data file.
			const result = await php2.run({
				code: `<?php
				try {
					$collator = new Collator('en_US');
					$data = ['banana', 'apple', 'cherry'];
					$collator->sort($data);
					echo json_encode($data);
				} catch (IntlException $e) {
					echo 'IntlException: ' . $e->getMessage();
				} catch (Exception $e) {
					echo 'Exception: ' . $e->getMessage();
				}
			`,
			});

			expect(result.exitCode).toBe(0);
			expect(result.text).toBe('["apple","banana","cherry"]');
		});

		it('should use NumberFormatter through PROXYFS', async () => {
			using php1 = new PHP(
				await loadNodeRuntime(phpVersion, { withIntl: true })
			);

			using php2 = new PHP(
				await loadNodeRuntime(phpVersion, { withIntl: true })
			);

			await proxyFileSystem(php1, php2, ['/internal/shared']);

			const result = await php2.run({
				code: `<?php
				try {
					$formatter = new NumberFormatter('en_US', NumberFormatter::CURRENCY);
					echo $formatter->format(1234.56);
				} catch (IntlException $e) {
					echo 'IntlException: ' . $e->getMessage();
				} catch (Exception $e) {
					echo 'Exception: ' . $e->getMessage();
				}
			`,
			});

			expect(result.exitCode).toBe(0);
			expect(result.text).toBe('$1,234.56');
		});
	}
);
