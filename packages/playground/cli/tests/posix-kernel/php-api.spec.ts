/**
 * Stdout-capture regression for `KernelLimitedPHPApi.run()`. The
 * blueprint-v1 smoke test only asserts filesystem side effects, so a
 * pid/buffer mis-mapping in `boot.ts`'s capture would go undetected.
 * Drives the API directly and checks `response.text` against the
 * expected stdout, sequentially and under a parallel-spawn loop.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { toPosixPath } from '@php-wasm/util';

import { bootPosixKernelWordPress } from '../../src/posix-kernel/boot';
import type { PosixKernelBootResult } from '../../src/posix-kernel/boot';
import { KernelLimitedPHPApi } from '../../src/posix-kernel/php-api';
import { prepareWordPressForPosixKernel } from '../../src/posix-kernel/prepare-wordpress';
import { reserveFreePort } from '../../src/start-server';
import {
	createPosixKernelTempDir,
	type PosixKernelTempDir,
} from '../../src/posix-kernel/temp-dir';

describe('--experimental-posix-kernel KernelLimitedPHPApi.run stdout capture', () => {
	let tempDir: PosixKernelTempDir;
	let booted: PosixKernelBootResult;
	let api: KernelLimitedPHPApi;

	beforeAll(async () => {
		tempDir = await createPosixKernelTempDir();
		const wordPressRootHostPath = join(tempDir.hostPath, 'wordpress');
		const wordPressRootKernelPath = toPosixPath(wordPressRootHostPath);
		await prepareWordPressForPosixKernel({
			wordPressRoot: wordPressRootHostPath,
			wpVersionQuery: 'latest',
		});
		const port = await reserveFreePort();
		booted = await bootPosixKernelWordPress({
			port,
			wordPressRootHostPath,
			wordPressRootKernelPath,
			tempDirHostPath: tempDir.hostPath,
			tempDirKernelPath: tempDir.kernelPath,
		});
		api = new KernelLimitedPHPApi({
			serverUrl: booted.serverUrl,
			wordPressRootHostPath,
			phpWasmPath: booted.runtime.phpWasmPath,
			runtime: booted.runtime,
		});
	}, 180_000);

	afterAll(async () => {
		await booted?.[Symbol.asyncDispose]?.();
		await tempDir?.cleanup?.();
	});

	it('preserves stdout across many sequential runs (no cross-pid leak)', async () => {
		for (let i = 0; i < 10; i++) {
			const marker = `SEQ_${i}`;
			const response = await api.run({
				code: `<?php echo "${marker}";`,
			});
			expect(response.text).toBe(marker);
		}
	}, 120_000);

	it('preserves stdout when many spawns race in parallel', async () => {
		const markers = Array.from({ length: 8 }, (_, i) => `PAR_${i}`);
		const results = await Promise.all(
			markers.map((marker) =>
				api.run({ code: `<?php echo "${marker}";` })
			)
		);
		for (let i = 0; i < markers.length; i++) {
			expect(results[i].text).toBe(markers[i]);
		}
	}, 120_000);
});
