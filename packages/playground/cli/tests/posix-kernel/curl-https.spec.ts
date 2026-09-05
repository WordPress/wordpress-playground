import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bootPosixKernelWordPress } from '../../src/posix-kernel/boot';
import type { PosixKernelBootResult } from '../../src/posix-kernel/boot';
import { KernelLimitedPHPApi } from '../../src/posix-kernel/php-api';
import { prepareWordPressForPosixKernel } from '../../src/posix-kernel/prepare-wordpress';
import {
	createPosixKernelTempDir,
	type PosixKernelTempDir,
} from '../../src/posix-kernel/temp-dir';

const TEST_PORT = 49152 + (process.pid % 16384);

describe('--experimental-posix-kernel HTTPS via curl.cainfo', () => {
	const README_URL =
		'https://raw.githubusercontent.com/WordPress/wordpress-playground/' +
		'5e5ba3e0f5b984ceadd5cbe6e661828c14621d25/README.md';
	const README_BYTES = 13061;

	let tempDir: PosixKernelTempDir;
	let booted: PosixKernelBootResult;
	let api: KernelLimitedPHPApi;

	beforeAll(async () => {
		tempDir = await createPosixKernelTempDir();
		const wordPressRootHostPath = join(tempDir.hostPath, 'wordpress');
		const wordPressRootKernelPath = `${tempDir.kernelPath}/wordpress`;
		await prepareWordPressForPosixKernel({
			wordPressRoot: wordPressRootHostPath,
			wpVersionQuery: 'latest',
		});
		booted = await bootPosixKernelWordPress({
			port: TEST_PORT,
			wordPressRootHostPath,
			wordPressRootKernelPath,
			tempDirHostPath: tempDir.hostPath,
			tempDirKernelPath: tempDir.kernelPath,
		});
		api = new KernelLimitedPHPApi({
			serverUrl: booted.serverUrl,
			wordPressRootHostPath,
			wordPressRootKernelPath,
			tempDirHostPath: tempDir.hostPath,
			tempDirKernelPath: tempDir.kernelPath,
			phpWasmPath: booted.runtime.phpWasmPath,
			runtime: booted.runtime,
		});
	}, 300_000);

	afterAll(async () => {
		await booted?.[Symbol.asyncDispose]?.();
		await tempDir?.cleanup?.();
	});

	it(
		'curl_exec() completes a verified HTTPS GET through curl.cainfo',
		{ retry: 2, timeout: 120_000 },
		async () => {
			const response = await api.run({
				code: `<?php
					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, "${README_URL}");
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
					curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
					curl_setopt($ch, CURLOPT_TIMEOUT, 60);
					// Force verification ON. The point of this test is to prove
					// the default curl.cainfo trust store works WITHOUT any bypass.
					curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
					curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
					$result = curl_exec($ch);
					if ($result === false) {
						echo "CURL_ERROR:" . curl_errno($ch) . ":" . curl_error($ch);
					} else {
						echo "LEN:" . strlen($result);
					}
					curl_close($ch);
				`,
			});
			expect(response.text).not.toContain('CURL_ERROR');
			expect(response.text).toBe(`LEN:${README_BYTES}`);
		}
	);
});
