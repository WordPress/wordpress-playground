import type {
	Emscripten,
	FileLockManager,
	WasmFileLockAdapter,
	WasmFileLockingUserSpaceAPI,
	WasmFileLockingUserSpaceContext,
} from '@php-wasm/universal';
import { bindFileLockingUserSpace } from '@php-wasm/universal';

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
	context: WasmUserSpaceContext
): WasmUserSpaceAPI {
	return bindFileLockingUserSpace(
		fileLockManager,
		createWebFileLockAdapter(context),
		context
	);
}

function createWebFileLockAdapter({
	FS,
	PROXYFS,
	errnoCodes: { EBADF },
}: WasmUserSpaceContext): WasmFileLockAdapter {
	function getLockTarget(fd: number) {
		const [vfsPath, vfsPathErrno] = getVfsPathFromFd(fd);
		if (vfsPathErrno !== 0) {
			return [null as never, vfsPathErrno] as const;
		}

		return [
			{
				fd,
				path: getPathForLock(vfsPath),
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

	function getPathForLock(vfsPath: string): string {
		const { node } = FS.lookupPath(vfsPath, { noent_okay: true });
		if (node?.mount.type === PROXYFS) {
			return PROXYFS.realPath(node);
		}
		return vfsPath;
	}

	return { getLockTarget, getLockFd };
}
