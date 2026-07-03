/**
 * Per-process syscall implementations that run in the context of a single
 * WASM PHP process. Analogous to OS user space: each process gets its own
 * instance bound to its PID, constants, and file descriptor table.
 */
import type {
	Emscripten,
	WasmFileLockAdapter,
	WasmFileLockingUserSpaceAPI,
	WasmFileLockingUserSpaceContext,
} from '@php-wasm/universal';
import { bindFileLockingUserSpace } from '@php-wasm/universal';
import type { WasmKernelSpace } from './wasm-kernel-space';
import { lookup } from 'dns/promises';

type FSNode = Emscripten.FS.FSNode;

type NonZeroNumber = Exclude<number, 0>;
type ResultTuple<T> =
	| readonly [value: T, errorCode: 0]
	| readonly [value: never, errorCode: NonZeroNumber];

export type WasmUserSpaceContext = WasmFileLockingUserSpaceContext & {
	constants: WasmFileLockingUserSpaceContext['constants'];
	errnoCodes: WasmFileLockingUserSpaceContext['errnoCodes'] & {
		EDEADLK: NonZeroNumber;
	};
	memory: WasmFileLockingUserSpaceContext['memory'] & {
		HEAP8: HeapAccessor<number>;
		HEAPU8: HeapAccessor<number>;
		HEAPU16: HeapAccessor<number>;
		HEAPU32: HeapAccessor<number>;
		HEAPF32: HeapAccessor<number>;
		HEAPU64: HeapAccessor<bigint>;
		HEAPF64: HeapAccessor<bigint>;
	};
	PROXYFS: typeof Emscripten.PROXYFS & {
		// Not in Emscripten's FileSystemType; augmented inline here.
		realPath(node: FSNode): string;
	};
	NODEFS: typeof Emscripten.NODEFS & {
		// Not in Emscripten's FileSystemType; augmented inline here.
		realPath(node: FSNode): string;
	};
};

type HeapAccessor<T> = {
	get(offset: number): T;
	set(offset: number, value: T): void;
};

export type WasmUserSpaceAPI = WasmFileLockingUserSpaceAPI & {
	gethostbyname: (hostname: string) => Promise<string>;
};

export function bindUserSpace(
	{ fileLockManager }: WasmKernelSpace,
	context: WasmUserSpaceContext
): WasmUserSpaceAPI {
	return {
		...bindFileLockingUserSpace(
			fileLockManager,
			createNodeFileLockAdapter(context),
			context
		),
		gethostbyname,
	};
}

function createNodeFileLockAdapter({
	FS,
	PROXYFS,
	NODEFS,
	errnoCodes: { EBADF, EINVAL },
	syscalls: { getStreamFromFD },
	wasmImports: { js_wasm_trace },
}: WasmUserSpaceContext): WasmFileLockAdapter {
	function getLockTarget(fd: number) {
		const [vfsPath, vfsPathErrno] = getVfsPathFromFd(fd);
		if (vfsPathErrno !== 0) {
			return [null as never, vfsPathErrno] as const;
		}
		if (!isPathToSharedFs(vfsPath)) {
			return [undefined, 0] as const;
		}

		const [lockFd, lockFdErrno] = getNativeFdFromEmscriptenFd(fd);
		if (lockFdErrno !== 0) {
			return [null as never, lockFdErrno] as const;
		}

		try {
			return [
				{
					fd: lockFd,
					path: getNativePathFromVfsPath(vfsPath),
				},
				0,
			] as const;
		} catch (e) {
			js_wasm_trace('getLockTarget(%d) error %s', fd, e);
			return [null as never, EINVAL] as const;
		}
	}

	function getLockFd(fd: number): ResultTuple<number> {
		return getNativeFdFromEmscriptenFd(fd);
	}

	function isPathToSharedFs(path: string) {
		const { node } = FS.lookupPath(path, { noent_okay: true });
		if (!node) {
			return false;
		}

		if (node.mount.type !== PROXYFS) {
			return !!node.isSharedFS;
		}

		// TODO: Do we still need PROXYFS now that Playground CLI uses NODEFS?
		const nodePath = PROXYFS.realPath(node);
		const backingFs = node?.mount?.opts?.['fs'];
		if (backingFs) {
			// Tolerate ENOENT because looking up a MEMFS node by path fails.
			const { node: backingNode } = backingFs.lookupPath(nodePath, {
				noent_okay: true,
			});
			return !!backingNode?.isSharedFS;
		}

		return false;
	}

	function getVfsPathFromFd(fd: number): ResultTuple<string> {
		try {
			return [FS.readlink(`/proc/self/fd/${fd}`), 0] as const;
		} catch {
			return [null as never, EBADF] as const;
		}
	}

	function getNativePathFromVfsPath(vfsPath: string) {
		const { node } = FS.lookupPath(vfsPath, {
			noent_okay: true,
		});
		if (!node) {
			throw new Error(`No node found for VFS path ${vfsPath}`);
		}
		if (node.mount.type === NODEFS) {
			return NODEFS.realPath(node);
		} else if (node.mount.type === PROXYFS) {
			const { node: backingNode, path: backingPath } =
				node.mount.opts['fs'].lookupPath(vfsPath);
			js_wasm_trace(
				'backingNode for %s: %s',
				vfsPath,
				backingPath,
				backingNode
			);
			return backingNode.mount.type.realPath(backingNode);
		} else {
			throw new Error(`Unsupported filesystem type for path ${vfsPath}`);
		}
	}

	function getNativeFdFromEmscriptenFd(fd: number): ResultTuple<number> {
		try {
			type MaybeNODEFSStream = Emscripten.FS.FSStream & {
				nfd?: number;
			};
			const stream = getStreamFromFD(fd) as MaybeNODEFSStream;
			if (stream.nfd === undefined) {
				return [null as never, EBADF] as const;
			}
			return [stream.nfd, 0] as const;
		} catch {
			return [null as never, EBADF] as const;
		}
	}

	return { getLockTarget, getLockFd };
}

/**
 * Resolve a hostname to an IP address.
 *
 * @param hostname The hostname to resolve.
 * @returns The IP address of the hostname as a string.
 */
async function gethostbyname(hostname: string): Promise<string> {
	const { address } = await lookup(hostname, {
		family: 4,
		verbatim: false,
	});
	return address;
}
