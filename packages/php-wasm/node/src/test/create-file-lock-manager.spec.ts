import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	FileLockManagerComposite,
	FileLockManagerInMemory,
} from '@php-wasm/universal';
import { createFileLockManager } from '../lib/create-file-lock-manager';
import { loadFsExt } from '../lib/load-fs-ext';

vi.mock('../lib/load-fs-ext', () => ({ loadFsExt: vi.fn() }));
vi.mock('@php-wasm/logger', () => ({ logger: { warn: vi.fn() } }));

describe('file lock backend selection', () => {
	beforeEach(() =>
		vi.mocked(loadFsExt).mockReturnValue({} as ReturnType<typeof loadFsExt>)
	);
	afterEach(() => vi.resetAllMocks());

	it('keeps the native and caller-supplied managers when the addon loads', () => {
		const shared = new FileLockManagerInMemory();
		const locks = createFileLockManager(shared);
		expect(locks).toBeInstanceOf(FileLockManagerComposite);
		expect((locks as FileLockManagerComposite).wasmLockManager).toBe(
			shared
		);
	});

	it.each([
		Object.assign(new Error("Cannot find module 'fs-ext-extra-prebuilt'"), {
			code: 'MODULE_NOT_FOUND',
		}),
		Object.assign(new Error('The native ABI does not match'), {
			code: 'ERR_DLOPEN_FAILED',
		}),
		new Error(
			'Failed to load fs-ext native module. No prebuilt binary found.'
		),
	])(
		'shares whole-file and byte-range locks when native loading fails: %s',
		(error) => {
			vi.mocked(loadFsExt).mockImplementation(() => {
				throw error;
			});
			const shared = new FileLockManagerInMemory();
			const first = createFileLockManager(shared);
			const second = createFileLockManager(shared);
			const op = {
				pid: 1,
				fd: 1,
				type: 'exclusive' as const,
				waitForLock: false,
			};
			expect(first.lockWholeFile('/file', op)).toBe(true);
			expect(
				second.lockWholeFile('/file', { ...op, pid: 2, fd: 2 })
			).toBe(false);
			first.releaseLocksOnFdClose(1, 1, '/file');
			expect(
				second.lockWholeFile('/file', { ...op, pid: 2, fd: 2 })
			).toBe(true);
			second.releaseLocksForProcess(2);

			const range = {
				pid: 1,
				fd: 1,
				type: 'exclusive' as const,
				start: 0n,
				end: 0n,
			};
			expect(first.lockFileByteRange('/file', range, false)).toBe(true);
			expect(
				second.lockFileByteRange(
					'/file',
					{ ...range, pid: 2, start: 100n, end: 200n },
					false
				)
			).toBe(false);
			expect(
				second.findFirstConflictingByteRangeLock('/file', {
					...range,
					pid: 2,
					end: 1n,
				})
			).toMatchObject({ pid: 1 });
			first.releaseLocksForProcess(1);
			expect(
				second.lockFileByteRange('/file', { ...range, pid: 2 }, false)
			).toBe(true);
		}
	);

	it('does not hide unrelated errors', () => {
		const error = new Error('Unexpected initialization error');
		vi.mocked(loadFsExt).mockImplementation(() => {
			throw error;
		});
		expect(() => createFileLockManager()).toThrow(error);
	});
});
