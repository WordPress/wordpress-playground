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

const runtimeFileSystemIds = new WeakMap<object, number>();
let nextRuntimeFileSystemId = 1;

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
			getLockPath(context, context.FS.getPath((stream as any).node)),
		(path) => getLockPath(context, path)
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
				path: getLockPath(context, vfsPath),
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

function getLockPath(
	{ FS, PROXYFS }: WasmUserSpaceContext,
	vfsPath: string
): string {
	const { node, path } = FS.lookupPath(vfsPath, { noent_okay: true });
	if (node?.mount.type === PROXYFS) {
		const backingFs = node.mount.opts?.['fs'];
		if (typeof backingFs === 'object' && backingFs !== null) {
			return `${getRuntimeFileSystemId(backingFs)}:${PROXYFS.realPath(node)}`;
		}
	}

	/*
	 * Absolute paths only identify files within a single Emscripten runtime.
	 * Two independent browser PHP runtimes both have paths such as
	 * `/tmp/wp.sqlite`, but those paths refer to different MEMFS files unless
	 * one runtime reaches the other through PROXYFS. Prefixing by the backing
	 * FS object keeps unrelated runtimes isolated while still giving PROXYFS
	 * users the same lock identity as the source runtime.
	 */
	return `${getRuntimeFileSystemId(FS)}:${path}`;
}

function getRuntimeFileSystemId(fs: object) {
	let id = runtimeFileSystemIds.get(fs);
	if (id === undefined) {
		id = nextRuntimeFileSystemId++;
		runtimeFileSystemIds.set(fs, id);
	}
	return id;
}
