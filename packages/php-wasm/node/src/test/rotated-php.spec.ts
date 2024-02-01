import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodePHP } from '..';
import { LatestSupportedPHPVersion, rotatedPHP } from '@php-wasm/universal';

const phpFactory = () =>
	NodePHP.load(LatestSupportedPHPVersion, {
		requestHandler: {
			documentRoot: '/test-root',
		},
	});

describe('rotatedPHP()', () => {
	it('Should recreate the PHP instance after maxRequests', async () => {
		const createPHP = vitest.fn(phpFactory);
		const php = await rotatedPHP({
			maxRequests: 1,
			createPHP,
		});
		// Rotate
		await php.run({
			code: `<?php echo 'hi';`,
		});
		await php.run({
			code: `<?php echo 'hi';`,
		});
		expect(createPHP).toHaveBeenCalledTimes(2);
	});

	it('Should preserve the MEMFS files', async () => {
		const createPHP = vitest.fn(phpFactory);
		const php = await rotatedPHP({
			maxRequests: 1,
			createPHP,
		});
		php.mkdir('/test-root');
		php.writeFile('/test-root/index.php', '<?php echo "hi";');
		// Rotate
		await php.run({
			code: `<?php echo 'hi';`,
		});
		await php.run({
			code: `<?php echo 'hi';`,
		});
		expect(php.fileExists('/test-root/index.php')).toBe(true);
		expect(php.readFileAsText('/test-root/index.php')).toBe(
			'<?php echo "hi";'
		);
	});
	it('Should not overwrite the NODEFS files', async () => {
		const createPHP = vitest.fn(phpFactory);
		const php = await rotatedPHP({
			maxRequests: 1,
			createPHP,
		});
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
			// Rotate
			await php.run({
				code: `<?php echo 'hi';`,
			});

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
