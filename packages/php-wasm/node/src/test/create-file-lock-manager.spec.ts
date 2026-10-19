import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	closeSync,
	linkSync,
	mkdtempSync,
	openSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import {
	FileLockManagerComposite,
	FileLockManagerInMemory,
	PHP,
} from '@php-wasm/universal';
import { createNodeFsMountHandler, loadNodeRuntime } from '../lib';
import { createFileLockManager } from '../lib/create-file-lock-manager';
import { loadFsExt } from '../lib/load-fs-ext';

vi.mock('../lib/load-fs-ext', () => ({ loadFsExt: vi.fn() }));
vi.mock('@php-wasm/logger', () => ({
	logger: { debug: vi.fn(), warn: vi.fn() },
}));

describe('file lock backend selection', () => {
	let dir: string;
	let path: string;
	let alias: string;
	let firstFd: number;
	let secondFd: number;
	let openFds: Set<number>;
	beforeEach(() => {
		dir = mkdtempSync(joinPaths(tmpdir(), 'php-lock-backend-'));
		path = joinPaths(dir, 'file');
		alias = joinPaths(dir, 'alias');
		writeFileSync(path, '');
		linkSync(path, alias);
		firstFd = openSync(path, 'r+');
		secondFd = openSync(alias, 'r+');
		openFds = new Set([firstFd, secondFd]);
	});
	beforeEach(() =>
		vi.mocked(loadFsExt).mockReturnValue({} as ReturnType<typeof loadFsExt>)
	);
	afterEach(() => {
		for (const fd of openFds) {
			closeSync(fd);
		}
		rmSync(dir, { recursive: true, force: true });
		vi.resetAllMocks();
	});

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
			expect(logger.warn).not.toHaveBeenCalled();
			const op = {
				pid: 1,
				fd: firstFd,
				type: 'exclusive' as const,
				waitForLock: false,
			};
			expect(first.lockWholeFile(path, op)).toBe(true);
			expect(
				second.lockWholeFile(path, { ...op, pid: 2, fd: secondFd })
			).toBe(false);
			first.releaseLocksOnFdClose(1, firstFd, path);
			expect(
				second.lockWholeFile(path, { ...op, pid: 2, fd: secondFd })
			).toBe(true);
			second.releaseLocksForProcess(2);

			const range = {
				pid: 1,
				fd: firstFd,
				type: 'exclusive' as const,
				start: 0n,
				end: 0n,
			};
			expect(first.lockFileByteRange(path, range, false)).toBe(true);
			expect(
				second.lockFileByteRange(
					path,
					{ ...range, pid: 2, fd: secondFd, start: 100n, end: 200n },
					false
				)
			).toBe(false);
			expect(
				second.findFirstConflictingByteRangeLock(path, {
					...range,
					pid: 2,
					fd: secondFd,
					end: 1n,
				})
			).toMatchObject({ pid: 1 });
			first.releaseLocksForProcess(1);
			expect(
				second.lockFileByteRange(
					path,
					{ ...range, pid: 2, fd: secondFd },
					false
				)
			).toBe(true);
		}
	);

	it.each(['whole-file', 'byte-range'])(
		'coordinates %s locks through hard links and releases them after close',
		(kind) => {
			vi.mocked(loadFsExt).mockImplementation(() => {
				throw Object.assign(new Error('Native ABI mismatch'), {
					code: 'ERR_DLOPEN_FAILED',
				});
			});
			const shared = new FileLockManagerInMemory();
			const first = createFileLockManager(shared);
			const second = createFileLockManager(shared);
			const op = {
				pid: 1,
				fd: firstFd,
				type: 'exclusive' as const,
				waitForLock: false,
				start: 0n,
				end: 1n,
			};
			const other = { ...op, pid: 2, fd: secondFd };
			const lock = (
				manager: typeof first,
				name: string,
				request: typeof op
			) =>
				kind === 'whole-file'
					? manager.lockWholeFile(name, request)
					: manager.lockFileByteRange(name, request, false);
			expect(lock(first, path, op)).toBe(true);
			expect(lock(second, alias, other)).toBe(false);
			expect(
				second.findFirstConflictingByteRangeLock(alias, other)
			).toMatchObject({ type: 'exclusive' });
			renameSync(path, joinPaths(dir, 'moved'));
			closeSync(firstFd);
			openFds.delete(firstFd);
			first.releaseLocksOnFdClose(1, firstFd, path);
			expect(lock(second, alias, other)).toBe(true);
		}
	);

	it('does not apply the old file lock to a replacement at the same path', () => {
		vi.mocked(loadFsExt).mockImplementation(() => {
			throw Object.assign(new Error('Native ABI mismatch'), {
				code: 'ERR_DLOPEN_FAILED',
			});
		});
		const shared = new FileLockManagerInMemory();
		const first = createFileLockManager(shared);
		const second = createFileLockManager(shared);
		const op = {
			pid: 1,
			fd: firstFd,
			type: 'exclusive' as const,
			waitForLock: false,
		};
		expect(first.lockWholeFile(path, op)).toBe(true);
		renameSync(path, joinPaths(dir, 'moved'));
		writeFileSync(path, '');
		const replacementFd = openSync(path, 'r+');
		openFds.add(replacementFd);
		expect(
			second.lockWholeFile(path, { ...op, pid: 2, fd: replacementFd })
		).toBe(true);
		expect(
			second.lockWholeFile(alias, { ...op, pid: 2, fd: secondFd })
		).toBe(false);
		first.releaseLocksForProcess(1);
		expect(
			second.lockWholeFile(alias, { ...op, pid: 2, fd: secondFd })
		).toBe(true);
	});

	it('preserves PHP flock protection across a rejected lock and a hard-link alias', async () => {
		vi.mocked(loadFsExt).mockImplementation(() => {
			throw Object.assign(new Error('Native ABI mismatch'), {
				code: 'ERR_DLOPEN_FAILED',
			});
		});
		using php = new PHP(
			await loadNodeRuntime('8.3', {
				fileLockManager: new FileLockManagerInMemory(),
				emscriptenOptions: { processId: 1 },
			})
		);
		php.mount('/test', createNodeFsMountHandler(dir));
		const result = await php.run({
			code: `<?php
				$first = fopen('/test/file', 'r+');
				$second = fopen('/test/file', 'r+');
				$alias = fopen('/test/alias', 'r+');
				$held = flock($first, LOCK_EX | LOCK_NB);
				$shared = flock($second, LOCK_SH | LOCK_NB);
				fclose($second);
				$alias_while_locked = flock($alias, LOCK_EX | LOCK_NB);
				flock($first, LOCK_UN);
				$alias_after_unlock = flock($alias, LOCK_EX | LOCK_NB);
				echo json_encode([$held, $shared, $alias_while_locked, $alias_after_unlock]);
			`,
		});
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.text)).toEqual([true, false, false, true]);
	});

	it('keeps the shared lock when a nonblocking exclusive upgrade fails', () => {
		vi.mocked(loadFsExt).mockImplementation(() => {
			throw Object.assign(new Error('Native ABI mismatch'), {
				code: 'ERR_DLOPEN_FAILED',
			});
		});
		const shared = new FileLockManagerInMemory();
		const first = createFileLockManager(shared);
		const second = createFileLockManager(shared);
		const op = {
			pid: 1,
			fd: firstFd,
			type: 'shared' as const,
			waitForLock: false,
		};
		expect(first.lockWholeFile(path, op)).toBe(true);
		expect(
			second.lockWholeFile(alias, { ...op, pid: 2, fd: secondFd })
		).toBe(true);
		expect(first.lockWholeFile(path, { ...op, type: 'exclusive' })).toBe(
			false
		);
		second.releaseLocksForProcess(2);
		expect(
			second.lockWholeFile(alias, {
				...op,
				pid: 2,
				fd: secondFd,
				type: 'exclusive',
			})
		).toBe(false);
		first.releaseLocksForProcess(1);
	});

	it('does not drop an exclusive lock when the same handle requests it again', () => {
		vi.mocked(loadFsExt).mockImplementation(() => {
			throw Object.assign(new Error('Native ABI mismatch'), {
				code: 'ERR_DLOPEN_FAILED',
			});
		});
		const shared = new FileLockManagerInMemory();
		const locks = createFileLockManager(shared);
		const op = {
			pid: 1,
			fd: firstFd,
			type: 'exclusive' as const,
			waitForLock: true,
		};
		expect(locks.lockWholeFile(path, op)).toBe(true);
		const spy = vi.spyOn(shared, 'lockWholeFile');
		expect(locks.lockWholeFile(path, op)).toBe(true);
		expect(
			spy.mock.calls.some(([, request]) => request.type === 'unlock')
		).toBe(false);
		locks.releaseLocksForProcess(1);
	});

	it('does not hide unrelated errors', () => {
		const error = new Error('Unexpected initialization error');
		vi.mocked(loadFsExt).mockImplementation(() => {
			throw error;
		});
		expect(() => createFileLockManager()).toThrow(error);
	});
});
