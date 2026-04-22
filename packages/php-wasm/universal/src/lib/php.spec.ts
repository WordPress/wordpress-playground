import { describe, expect, it, vi } from 'vitest';
import { __private__dont__use, PHP } from './php';

describe('PHP mounts', () => {
	it('forgets mount tracking even when the unmount callback fails', async () => {
		const php = new PHP();
		(php as any)[__private__dont__use] = {
			FS: {
				chdir: vi.fn(),
				cwd: vi.fn(() => '/'),
				lookupPath: vi.fn(() => ({})),
				readdir: vi.fn(() => ['.', '..']),
			},
			spawnProcess: undefined,
		};
		const unmountError = new Error('unmount failed');
		const unmountCallback = vi.fn(async () => {
			throw unmountError;
		});
		const unmount = await php.mount('/mounted', async () => {
			return unmountCallback;
		});

		await expect(unmount()).rejects.toBe(unmountError);
		await expect(php.hotSwapPHPRuntime(0 as any)).rejects.toThrow(
			'Runtime with id 0 not found'
		);

		expect(unmountCallback).toHaveBeenCalledTimes(1);
	});
});
