import type {
	Emscripten,
	FileLockManager,
	RequestedRangeLock,
	WasmFileLockAdapter,
	WasmFileLockTarget,
	WasmFileLockingUserSpaceAPI,
	WasmFileLockingUserSpaceContext,
} from '@php-wasm/universal';
import { bindFileLockingUserSpace } from '@php-wasm/universal';
import type { SQLiteSharedMemory } from './sqlite-shared-memory';

type FSNode = Emscripten.FS.FSNode;

type NonZeroNumber = Exclude<number, 0>;
type ResultTuple<T> =
	| readonly [value: T, errorCode: 0]
	| readonly [value: never, errorCode: NonZeroNumber];

export type WasmUserSpaceContext = WasmFileLockingUserSpaceContext & {
	PROXYFS: typeof Emscripten.PROXYFS & {
		realPath(node: FSNode): string;
	};
};

export type WasmUserSpaceAPI = WasmFileLockingUserSpaceAPI;

export function bindUserSpace(
	fileLockManager: FileLockManager | undefined,
	sqliteSharedMemory: SQLiteSharedMemory | undefined,
	context: WasmUserSpaceContext
): WasmUserSpaceAPI {
	sqliteSharedMemory?.install(
		context,
		(stream) =>
			getPathForLock(context, context.FS.getPath((stream as any).node)),
		(path) => getPathForLock(context, path)
	);

	return bindFileLockingUserSpace(
		fileLockManager,
		createWebFileLockAdapter(context, sqliteSharedMemory),
		context
	);
}

function createWebFileLockAdapter(
	context: WasmUserSpaceContext,
	sqliteSharedMemory: SQLiteSharedMemory | undefined
): WasmFileLockAdapter {
	const {
		FS,
		errnoCodes: { EBADF },
		pid,
	} = context;
	function getLockTarget(fd: number) {
		const [vfsPath, vfsPathErrno] = getVfsPathFromFd(fd);
		if (vfsPathErrno !== 0) {
			return [null as never, vfsPathErrno] as const;
		}

		return [
			{
				fd,
				path: getPathForLock(context, vfsPath),
			},
			0,
		] as const;
	}

	function getLockFd(fd: number): ResultTuple<number> {
		return [fd, 0] as const;
	}

	function getVfsPathFromFd(fd: number): ResultTuple<string> {
		try {
			return [FS.readlink(`/proc/self/fd/${fd}`), 0] as const;
		} catch {
			return [null as never, EBADF] as const;
		}
	}

	function beforeRangeLock(
		target: WasmFileLockTarget,
		lock: RequestedRangeLock
	) {
		if (lock.type === 'unlocked') {
			sqliteSharedMemory?.beforeUnlock(pid, target.path);
		} else {
			sqliteSharedMemory?.beforeRangeLock(pid, target.path);
		}
	}

	function afterRangeLock(
		target: WasmFileLockTarget,
		lock: RequestedRangeLock
	) {
		if (lock.type !== 'unlocked') {
			sqliteSharedMemory?.afterRangeLock(pid, target.path);
		}
	}

	function beforeFdClose(target: WasmFileLockTarget) {
		sqliteSharedMemory?.beforeFdClose(pid, target.path);
	}

	function beforeProcessExit() {
		sqliteSharedMemory?.beforeProcessExit(pid);
	}

	return {
		getLockTarget,
		getLockFd,
		beforeRangeLock,
		afterRangeLock,
		beforeFdClose,
		beforeProcessExit,
	};
}

function getPathForLock(
	{ FS, PROXYFS }: WasmUserSpaceContext,
	vfsPath: string
): string {
	const { node } = FS.lookupPath(vfsPath, { noent_okay: true });
	if (node?.mount.type === PROXYFS) {
		return PROXYFS.realPath(node);
	}
	return vfsPath;
}
