import type { PHP } from './php';

/**
 * Ensures PROXYFS has mmap support.
 *
 * PROXYFS proxies filesystem operations from one Emscripten FS instance to another,
 * enabling file sharing between PHP instances. However, PROXYFS lacks mmap support
 * by default, which causes libraries like ICU (used by the Intl extension) to fail
 * when trying to memory-map data files through a proxied filesystem.
 *
 * This function adds mmap and msync methods to PROXYFS.stream_ops if they don't
 * already exist. The mmap implementation reads the file contents via the proxied
 * filesystem and copies them into allocated memory, simulating mmap behavior.
 *
 * @param phpInstance - The PHP instance whose PROXYFS should be patched
 */
function ensureProxyFSHasMmapSupport(phpInstance: PHP) {
	const __private__symbol = Object.getOwnPropertySymbols(phpInstance)[0];
	// @ts-ignore
	const runtime = phpInstance[__private__symbol];
	const PROXYFS = runtime.PROXYFS;
	const FS = runtime.FS;

	// Skip if mmap is already defined
	if (PROXYFS.stream_ops.mmap) {
		return;
	}

	/**
	 * Memory-map a file from a proxied filesystem.
	 *
	 * Since PROXYFS doesn't have direct access to the underlying buffer,
	 * we allocate new memory and copy the file contents into it.
	 *
	 * @param stream - The file stream to map
	 * @param length - Number of bytes to map
	 * @param position - File offset to start mapping from
	 * @param prot - Memory protection flags (unused, we always allocate read/write)
	 * @param flags - Mapping flags (unused)
	 */
	/* eslint-disable @typescript-eslint/no-unused-vars */
	PROXYFS.stream_ops.mmap = function (
		stream: any,
		length: number,
		position: number,
		prot: number,
		flags: number
	) {
		/* eslint-enable @typescript-eslint/no-unused-vars */
		// Only files can be memory-mapped
		if (!FS.isFile(stream.node.mode)) {
			throw new FS.ErrnoError(19); // ENODEV
		}

		// For non-.dat files, get the actual file size from the proxied filesystem.
		// This is needed because older PHP versions (7.2-7.4) may pass incorrect
		// length values for certain file types.
		const path = FS.getPath(stream.node);
		if (!path.endsWith('.dat')) {
			// Get the proxied filesystem from the mount options
			const proxyFS = stream.node.mount.opts.fs;
			if (proxyFS && stream.nfd !== undefined) {
				const stat = proxyFS.fstat(stream.nfd);
				if (stat && stat.size !== undefined) {
					length = stat.size >>> 0;
				}
			}
		}

		// Only support mmap from the beginning of the file
		if (position !== 0) {
			throw new FS.ErrnoError(22); // EINVAL
		}

		// Allocate memory for the mapped region using the runtime's malloc.
		const ptr = runtime.malloc(length);
		if (!ptr) {
			throw new FS.ErrnoError(48); // ENOMEM
		}

		// Create a view into the heap for reading
		const heap = runtime.HEAPU8.subarray(ptr, ptr + length);
		let total = 0;

		// Eagerly read the entire file contents into the allocated memory
		while (total < length) {
			const bytesRead = stream.stream_ops.read(
				stream,
				heap,
				total,
				length - total,
				total
			);

			if (bytesRead <= 0) break;
			total += bytesRead;
		}

		// If we couldn't read the expected amount, free memory and return error
		if (total !== length) {
			runtime.free(ptr);
			throw new FS.ErrnoError(5); // EIO
		}

		return { ptr: ptr, allocated: true };
	};

	/**
	 * Sync memory-mapped changes back to the file.
	 *
	 * This is called when munmap is invoked. If the mapping was MAP_SHARED,
	 * the changes should be written back to the file.
	 */
	PROXYFS.stream_ops.msync = function (
		stream: any,
		buffer: Uint8Array,
		offset: number,
		length: number,
		mmapFlags: number
	) {
		// MAP_PRIVATE (flags & 2) means changes are not written back
		if (!(mmapFlags & 2)) {
			stream.stream_ops.write(
				stream,
				buffer,
				offset,
				length,
				offset,
				false
			);
		}
		return 0;
	};
}

/**
 * Proxy specific paths to the parent's MEMFS instance.
 * This is useful for sharing the WordPress installation
 * between the parent and child processes.
 */
export function proxyFileSystem(
	sourceOfTruth: PHP,
	replica: PHP,
	paths: string[]
) {
	// Ensure PROXYFS has mmap support before mounting.
	// This is needed for libraries like ICU that rely on memory-mapping files.
	ensureProxyFSHasMmapSupport(replica);

	// We can't just import the symbol from the library because
	// Playground CLI is built as ESM and php-wasm-node is built as
	// CJS and the imported symbols will differ in the production build.
	// Get symbols from both instances to ensure correct property access.
	const replicaSymbol = Object.getOwnPropertySymbols(replica)[0];
	const sourceSymbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];
	for (const path of paths) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		// @ts-ignore
		replica[replicaSymbol].FS.mount(
			// @ts-ignore
			replica[replicaSymbol].PROXYFS,
			{
				root: path,
				// @ts-ignore
				fs: sourceOfTruth[sourceSymbol].FS,
			},
			path
		);
	}
}

/**
 * Answers whether the given path is to a shared filesystem.
 *
 * @param sourceOfTruth - The PHP instance that is the source of truth.
 * @param path - The path to check.
 * @returns True if the path is to a shared filesystem, false otherwise.
 */
export function isPathToSharedFS(sourceOfTruth: PHP, path: string) {
	// We can't just import the symbol from the library because
	// Playground CLI is built as ESM and php-wasm-node is built as
	// CJS and the imported symbols will different in the production build.
	const __private__symbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];

	// @ts-ignore
	const FS = sourceOfTruth[__private__symbol].FS;

	const fsResult = FS.lookupPath(path, { noent_okay: true });
	return fsResult?.node?.isSharedFS ?? false;
}
