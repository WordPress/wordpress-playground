import { describe, expect, it, vi } from 'vitest';
import { CookieJar } from './cookie-jar';
import { KernelLimitedPHPApi } from './php-api';
import type { KernelSpawnAdapter } from './kernel-spawn-adapter';

function makeApi(runPhpCli: ReturnType<typeof vi.fn>): KernelLimitedPHPApi {
	return new KernelLimitedPHPApi({
		absoluteUrl: 'http://127.0.0.1:0',
		adapter: { runPhpCli } as unknown as KernelSpawnAdapter,
		sendRequest: vi.fn(),
		cookieJar: new CookieJar(),
	});
}

describe('KernelLimitedPHPApi.run failure semantics', () => {
	it('throws on a non-zero exit code, mirroring PHP.run()', async () => {
		const runPhpCli = vi.fn().mockResolvedValue({
			exitCode: 255,
			stdout: new Uint8Array(),
			stderr: new TextEncoder().encode('Fatal error: boom'),
		});
		const api = makeApi(runPhpCli);
		await expect(api.run({ code: '<?php exit(255);' })).rejects.toThrow(
			/exit code 255[\s\S]*Fatal error: boom/
		);
	});

	it('returns the response on a zero exit code', async () => {
		const runPhpCli = vi.fn().mockResolvedValue({
			exitCode: 0,
			stdout: new TextEncoder().encode('ok'),
			stderr: new Uint8Array(),
		});
		const api = makeApi(runPhpCli);
		const response = await api.run({ code: '<?php echo "ok";' });
		expect(response.text).toBe('ok');
		expect(response.exitCode).toBe(0);
	});
});

describe('KernelLimitedPHPApi.runStream failure semantics', () => {
	it('reports a non-zero exit code instead of throwing, mirroring PHP.runStream()', async () => {
		const runPhpCli = vi.fn().mockResolvedValue({
			exitCode: 1,
			stdout: new TextEncoder().encode('partial output'),
			stderr: new TextEncoder().encode('Warning: skipped'),
		});
		const api = makeApi(runPhpCli);
		const response = await api.runStream({ code: '<?php exit(1);' });
		expect(await response.exitCode).toBe(1);
		expect(await response.stdoutText).toBe('partial output');
		expect(await response.stderrText).toBe('Warning: skipped');
	});
});
