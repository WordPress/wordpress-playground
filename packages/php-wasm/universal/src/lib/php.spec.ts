import { describe, expect, it, vi } from 'vitest';
import { __private__dont__use, PHP } from './php';

describe('PHP mounts', () => {
	it('forgets mount tracking even when the unmount callback fails', async () => {
		// `PHP#mount` stores each mount in the private `#mounts` map and
		// returns a thin wrapper that:
		//
		// 1. Invokes the underlying unmount callback returned by the
		//    mount handler.
		// 2. Deletes the entry from `#mounts` in a `finally` block so the
		//    JS-side bookkeeping stays authoritative even if the
		//    underlying filesystem unmount throws.
		//
		// `#mounts` is not observable from outside the class, so we
		// verify the cleanup transitively through `hotSwapPHPRuntime`,
		// which iterates `#mounts` and awaits `mount.unmount()` on each
		// entry before initializing the new runtime. Two assertions
		// together prove the entry was removed:
		//
		// - `hotSwapPHPRuntime(0)` must reject with the downstream
		//   `'Runtime with id 0 not found'` error (raised by
		//   `initializeRuntime` via `popLoadedRuntime`). If `#mounts`
		//   still held the failed entry, the iteration would re-invoke
		//   `unmountCallback` and the rejection would be `unmountError`
		//   instead, never reaching `initializeRuntime`.
		//
		// - `unmountCallback` must have been called exactly once across
		//   both the explicit `unmount()` call and the subsequent
		//   `hotSwapPHPRuntime` attempt. Any stale `#mounts` entry would
		//   bump the count to 2.
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
		expect(unmountCallback).toHaveBeenCalledTimes(1);

		await expect(php.hotSwapPHPRuntime(0 as any)).rejects.toThrow(
			'Runtime with id 0 not found'
		);
		expect(unmountCallback).toHaveBeenCalledTimes(1);
	});
});
