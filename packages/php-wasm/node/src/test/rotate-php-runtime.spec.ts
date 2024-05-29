import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	LatestSupportedPHPVersion,
	PHP,
	__private__dont__use,
	rotatePHPRuntime,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { NodeFSMount } from '../lib/node-fs-mount';

const recreateRuntime = async (version: any = LatestSupportedPHPVersion) =>
	await loadNodeRuntime(version);

describe('rotatePHPRuntime()', () => {
	it('Free up the available PHP memory', async () => {
		const freeMemory = (php: PHP) =>
			php[__private__dont__use].HEAPU32.reduce(
				(count: number, byte: number) =>
					byte === 0 ? count + 1 : count,
				0
			);

		const recreateRuntimeSpy = vitest.fn(recreateRuntime);
		// Rotate the PHP runtime
		const php = new PHP(await recreateRuntime());
		rotatePHPRuntime({
			php,
			cwd: '/test-root',
			recreateRuntime: recreateRuntimeSpy,
			maxRequests: 1000,
		});
		const freeInitially = freeMemory(php);
		for (let i = 0; i < 1000; i++) {
			await php.run({
				code: `<?php
			// Do some string allocations
			for($i=0;$i<10;$i++) {
				echo "abc";
			}
			file_put_contents('./test', 'test');
			`,
			});
		}
		const freeAfter1000Requests = freeMemory(php);
		expect(freeAfter1000Requests).toBeLessThan(freeInitially);

		// Rotate the PHP runtime
		await php.run({ code: `<?php echo "abc";` });
		const freeAfterRotation = freeMemory(php);
		expect(freeAfterRotation).toBeGreaterThan(freeAfter1000Requests);
	}, 30_000);

	it('Should recreate the PHP runtime after maxRequests', async () => {
		const recreateRuntimeSpy = vitest.fn(recreateRuntime);
		const php = new PHP(await recreateRuntimeSpy());
		rotatePHPRuntime({
			php,
			cwd: '/test-root',
			recreateRuntime: recreateRuntimeSpy,
			maxRequests: 1,
		});
		// Rotate the PHP runtime
		await php.run({ code: `` });
		expect(recreateRuntimeSpy).toHaveBeenCalledTimes(2);
	}, 30_000);

	it('Should stop rotating after the cleanup handler is called', async () => {
		const recreateRuntimeSpy = vitest.fn(recreateRuntime);
		const php = new PHP(await recreateRuntimeSpy());
		const cleanup = rotatePHPRuntime({
			php,
			cwd: '/test-root',
			recreateRuntime: recreateRuntimeSpy,
			maxRequests: 1,
		});
		// Rotate the PHP runtime
		await php.run({ code: `` });
		expect(recreateRuntimeSpy).toHaveBeenCalledTimes(2);

		cleanup();

		// No further rotation should happen
		await php.run({ code: `` });
		await php.run({ code: `` });

		expect(recreateRuntimeSpy).toHaveBeenCalledTimes(2);
	}, 30_000);

	it('Should hotswap the PHP runtime from 8.2 to 8.3', async () => {
		let nbCalls = 0;
		const recreateRuntimeSpy = vitest.fn(() => {
			if (nbCalls === 0) {
				++nbCalls;
				return recreateRuntime('8.2');
			}
			return recreateRuntime('8.3');
		});
		const php = new PHP(await recreateRuntimeSpy());
		rotatePHPRuntime({
			php,
			cwd: '/test-root',
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
	}, 30_000);

	it('Should preserve the custom SAPI name', async () => {
		const php = new PHP(await recreateRuntime());
		rotatePHPRuntime({
			php,
			cwd: '/test-root',
			recreateRuntime,
			maxRequests: 1,
		});
		php.setSapiName('custom SAPI');

		// Rotate the PHP runtime
		await php.run({ code: `` });
		const result = await php.run({
			code: `<?php echo php_sapi_name();`,
		});
		expect(result.text).toBe('custom SAPI');
	});

	it('Should preserve the MEMFS files', async () => {
		const php = new PHP(await recreateRuntime());
		rotatePHPRuntime({
			php,
			cwd: '/test-root',
			recreateRuntime,
			maxRequests: 1,
		});

		// Rotate the PHP runtime
		await php.run({ code: `` });

		php.mkdir('/test-root');
		php.writeFile('/test-root/index.php', '<?php echo "hi";');

		// Rotate the PHP runtime
		await php.run({ code: `` });

		expect(php.fileExists('/test-root/index.php')).toBe(true);
		expect(php.readFileAsText('/test-root/index.php')).toBe(
			'<?php echo "hi";'
		);
	}, 30_000);

	it('Should not overwrite the NODEFS files', async () => {
		const php = new PHP(await recreateRuntime());
		rotatePHPRuntime({
			php,
			cwd: '/test-root',
			recreateRuntime,
			maxRequests: 1,
		});

		// Rotate the PHP runtime
		await php.run({ code: `` });

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
			php.mount('/test-root/nodefs', new NodeFSMount(tempDir));

			// Rotate the PHP runtime
			await php.run({ code: `` });

			// Expect the file to still have the same utime
			const stats = fs.statSync(tempFile);
			expect(Math.round(stats.atimeMs)).toBe(Math.round(date.getTime()));

			// The MEMFS file should still be there
			expect(php.fileExists('/test-root/index.php')).toBe(true);
		} finally {
			fs.rmSync(tempFile);
			fs.rmdirSync(tempDir);
		}
	}, 30_000);
});
