import type { Emscripten } from '@php-wasm/universal';

type ByteHeap = {
	get(offset: number): number;
	set(offset: number, value: number): void;
};

type SharedMemoryContext = {
	pid: number;
	memory: {
		HEAPU8: ByteHeap;
	};
	syscalls: {
		doMsync?: (
			addr: number,
			stream: Emscripten.FS.FSStream,
			len: number,
			flags: number,
			offset: number
		) => void;
	};
	FS: typeof Emscripten.FS;
};

type Mapping = {
	pid: number;
	path: string;
	ptr: number;
	length: number;
	position: number;
	heap: ByteHeap;
	version: number;
};

type SharedFile = {
	bytes: Uint8Array;
	mappings: Set<Mapping>;
	version: number;
};

type ResolveStreamPath = (stream: Emscripten.FS.FSStream) => string | undefined;
type ResolveVfsPath = (path: string) => string;

const MAP_PRIVATE = 2;
const patchedRuntimes = new WeakSet<object>();

/**
 * Keeps SQLite WAL-index mappings coherent across browser PHP runtimes.
 *
 * Each PHP runtime has its own Wasm linear memory, so a POSIX MAP_SHARED
 * mapping cannot literally point at the same bytes in two runtimes. SQLite
 * protects every WAL-index mutation with fcntl locks on the `-shm` file, so
 * we use those lock boundaries to copy the latest bytes into/out of each
 * runtime's mapped Wasm memory.
 */
export class SQLiteSharedMemory {
	private files = new Map<string, SharedFile>();

	install(
		context: SharedMemoryContext,
		resolveStreamPath: ResolveStreamPath,
		resolveVfsPath: ResolveVfsPath
	) {
		if (patchedRuntimes.has(context.FS as object)) {
			return;
		}
		patchedRuntimes.add(context.FS as object);

		this.patchMmap(context, resolveStreamPath);
		this.patchDoMsync(context, resolveStreamPath);
		this.patchUnlink(context, resolveVfsPath);
		this.patchTruncate(context, resolveVfsPath);
	}

	beforeRangeLock(pid: number, path: string) {
		this.copySharedBytesIntoProcessMappings(pid, path);
	}

	afterRangeLock(pid: number, path: string) {
		this.copySharedBytesIntoProcessMappings(pid, path);
	}

	beforeUnlock(pid: number, path: string) {
		this.copyProcessMappingsIntoSharedBytes(pid, path);
	}

	beforeFdClose(pid: number, path: string) {
		this.copyProcessMappingsIntoSharedBytes(pid, path);
	}

	beforeProcessExit(pid: number) {
		for (const path of this.files.keys()) {
			this.copyProcessMappingsIntoSharedBytes(pid, path);
		}
	}

	private patchMmap(
		context: SharedMemoryContext,
		resolveStreamPath: ResolveStreamPath
	) {
		const originalMmap = (context.FS.mmap as any).bind(context.FS);
		(context.FS.mmap as any) = (
			stream: Emscripten.FS.FSStream,
			length: number,
			position: number,
			prot: number,
			flags: number
		) => {
			const result = originalMmap(
				stream,
				length,
				position,
				prot,
				flags
			) as unknown as { ptr: number };
			if (isPrivateMapping(flags)) {
				return result;
			}

			const path = resolveStreamPath(stream);
			if (!isSQLiteSharedMemoryPath(path)) {
				return result;
			}

			this.registerMapping({
				pid: context.pid,
				path,
				ptr: result.ptr,
				length,
				position,
				heap: context.memory.HEAPU8,
				version: -1,
			});

			return result;
		};
	}

	private patchDoMsync(
		context: SharedMemoryContext,
		resolveStreamPath: ResolveStreamPath
	) {
		const originalDoMsync = context.syscalls.doMsync?.bind(
			context.syscalls
		);
		if (!originalDoMsync) {
			return;
		}

		context.syscalls.doMsync = (addr, stream, len, flags, offset) => {
			const path = resolveStreamPath(stream);
			if (!isPrivateMapping(flags) && isSQLiteSharedMemoryPath(path)) {
				this.copyMappingIntoSharedBytes({
					pid: context.pid,
					path,
					ptr: addr,
					length: len,
					position: offset,
					heap: context.memory.HEAPU8,
					version: -1,
				});
				this.unregisterMapping(context.pid, path, addr, offset);
			}
			return originalDoMsync(addr, stream, len, flags, offset);
		};
	}

	private patchUnlink(
		context: SharedMemoryContext,
		resolveVfsPath: ResolveVfsPath
	) {
		const originalUnlink = context.FS.unlink.bind(context.FS);
		context.FS.unlink = (path: string) => {
			const resolvedPath = resolveVfsPath(path);
			const result = originalUnlink(path);
			if (isSQLiteSharedMemoryPath(resolvedPath)) {
				this.deleteFileIfNotMapped(resolvedPath);
			}
			return result;
		};
	}

	private patchTruncate(
		context: SharedMemoryContext,
		resolveVfsPath: ResolveVfsPath
	) {
		const FS = context.FS as typeof Emscripten.FS & {
			truncate?: (path: string, len: number) => void;
		};
		const originalTruncate = FS.truncate?.bind(FS);
		if (!originalTruncate) {
			return;
		}

		FS.truncate = (path: string, len: number) => {
			const resolvedPath =
				typeof path === 'string' ? resolveVfsPath(path) : undefined;
			const result = originalTruncate(path, len);
			if (isSQLiteSharedMemoryPath(resolvedPath) && len === 0) {
				this.deleteFileIfNotMapped(resolvedPath);
			}
			return result;
		};
	}

	private registerMapping(mapping: Mapping) {
		const file = this.getOrCreateFile(mapping);
		file.mappings.add(mapping);
		this.copySharedBytesIntoMapping(mapping, file);
	}

	private unregisterMapping(
		pid: number,
		path: string,
		ptr: number,
		position: number
	) {
		const file = this.files.get(path);
		if (!file) {
			return;
		}
		for (const mapping of file.mappings) {
			if (
				mapping.pid === pid &&
				mapping.ptr === ptr &&
				mapping.position === position
			) {
				file.mappings.delete(mapping);
				this.deleteFileIfNotMapped(path);
				return;
			}
		}
	}

	private deleteFileIfNotMapped(path: string) {
		const file = this.files.get(path);
		if (!file || file.mappings.size === 0) {
			this.files.delete(path);
		}
	}

	private getOrCreateFile(mapping: Mapping) {
		let file = this.files.get(mapping.path);
		if (!file) {
			file = {
				bytes: new Uint8Array(mapping.position + mapping.length),
				mappings: new Set(),
				version: 0,
			};
			this.files.set(mapping.path, file);
			this.copyMappingIntoFile(mapping, file, false);
		}
		this.ensureFileSize(file, mapping.position + mapping.length);
		return file;
	}

	private copyProcessMappingsIntoSharedBytes(pid: number, path: string) {
		const file = this.files.get(path);
		if (!file) {
			return;
		}
		for (const mapping of file.mappings) {
			if (mapping.pid === pid) {
				this.copyMappingIntoSharedBytes(mapping);
			}
		}
	}

	private copySharedBytesIntoProcessMappings(pid: number, path: string) {
		const file = this.files.get(path);
		if (!file) {
			return;
		}
		for (const mapping of file.mappings) {
			if (mapping.pid === pid) {
				this.copySharedBytesIntoMapping(mapping, file);
			}
		}
	}

	private copyMappingIntoSharedBytes(mapping: Mapping) {
		const file = this.getOrCreateFile(mapping);
		this.copyMappingIntoFile(mapping, file, true);
	}

	private copyMappingIntoFile(
		mapping: Mapping,
		file: SharedFile,
		incrementVersion: boolean
	) {
		this.ensureFileSize(file, mapping.position + mapping.length);
		for (let i = 0; i < mapping.length; i++) {
			file.bytes[mapping.position + i] = mapping.heap.get(
				mapping.ptr + i
			);
		}
		if (incrementVersion) {
			file.version++;
		}
		mapping.version = file.version;
	}

	private copySharedBytesIntoMapping(mapping: Mapping, file: SharedFile) {
		if (mapping.version >= file.version) {
			return;
		}
		this.ensureFileSize(file, mapping.position + mapping.length);
		for (let i = 0; i < mapping.length; i++) {
			mapping.heap.set(
				mapping.ptr + i,
				file.bytes[mapping.position + i]
			);
		}
		mapping.version = file.version;
	}

	private ensureFileSize(file: SharedFile, size: number) {
		if (file.bytes.length >= size) {
			return;
		}
		const expanded = new Uint8Array(size);
		expanded.set(file.bytes);
		file.bytes = expanded;
	}
}

function isPrivateMapping(flags: number) {
	return (flags & MAP_PRIVATE) !== 0;
}

function isSQLiteSharedMemoryPath(path: string | undefined): path is string {
	return path !== undefined && path.endsWith('-shm');
}
