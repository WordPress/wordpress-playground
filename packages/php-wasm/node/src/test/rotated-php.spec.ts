import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodePHP } from '..';
import { LatestSupportedPHPVersion, rotatedPHP } from '@php-wasm/universal';

const recreateRuntime = async (version: any = LatestSupportedPHPVersion) =>
	await NodePHP.loadRuntime(version);

async function rotate(php: any) {
	await php.run({
		code: `<?php echo 'hi';`,
	});
	await php.run({
		code: `<?php echo 'hi';`,
	});
}

describe('rotatedPHP()', () => {
	it('Should recreate the PHP instance after maxRequests', async () => {
		const recreateRuntimeSpy = vitest.fn(recreateRuntime);
		const php = await rotatedPHP({
			php: new NodePHP(await recreateRuntimeSpy(), {
				documentRoot: '/test-root',
			}),
			recreateRuntime: recreateRuntimeSpy,
			maxRequests: 1,
		});
		await rotate(php);
		expect(recreateRuntimeSpy).toHaveBeenCalledTimes(2);
	});

	it('Should hotswap the PHP instance from 8.2 to 8.3', async () => {
		let nbCalls = 0;
		const recreateRuntimeSpy = vitest.fn(() =>
			++nbCalls === 1 ? recreateRuntime('8.2') : recreateRuntime('8.3')
		);
		const php = await rotatedPHP({
			php: new NodePHP(await recreateRuntimeSpy(), {
				documentRoot: '/test-root',
			}),
			recreateRuntime: recreateRuntimeSpy,
			maxRequests: 1,
		});
		const version1 = (
			await php.run({
				code: `<?php echo PHP_VERSION;`,
			})
		).text;
		const version2 = (
			await php.run({
				code: `<?php echo PHP_VERSION;`,
			})
		).text;
		expect(version1).toMatch(/^8\.2/);
		expect(version2).toMatch(/^8\.3/);
	});

	it('Should preserve the MEMFS files', async () => {
		const php = await rotatedPHP({
			php: new NodePHP(await recreateRuntime(), {
				documentRoot: '/test-root',
			}),
			recreateRuntime,
			maxRequests: 1,
		});
		await rotate(php);
		php.mkdir('/test-root');
		php.writeFile('/test-root/index.php', '<?php echo "hi";');
		await rotate(php);
		expect(php.fileExists('/test-root/index.php')).toBe(true);
		expect(php.readFileAsText('/test-root/index.php')).toBe(
			'<?php echo "hi";'
		);
	});
	it('Should not overwrite the NODEFS files', async () => {
		const php = await rotatedPHP({
			php: new NodePHP(await recreateRuntime(), {
				documentRoot: '/test-root',
			}),
			recreateRuntime,
			maxRequests: 1,
		});
		await rotate(php);
		php.mkdir('/test-root');
		php.writeFile('/test-root/index.php', 'test');
		php.mkdir('/test-root/nodefs');

		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-'));
		const tempFile = path.join(tempDir, 'file');
		fs.writeFileSync(tempFile, 'playground');
		const date = new Date();
		date.setFullYear(date.getFullYear() - 1);
		fs.utimesSync(tempFile, date, date);
		try {
			php.mount(tempDir, '/test-root/nodefs');

			await rotate(php);

			// Expect the file to still have the same utime
			const stats = fs.statSync(tempFile);
			expect(Math.round(stats.atimeMs)).toBe(Math.round(date.getTime()));

			// The MEMFS file should still be there
			expect(php.fileExists('/test-root/index.php')).toBe(true);
		} finally {
			fs.rmSync(tempFile);
			fs.rmdirSync(tempDir);
		}
	});
});
