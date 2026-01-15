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

		// Allocate memory for the mapped region using the runtime's malloc
		const ptr = runtime.wasmExports.malloc(length);
		if (!ptr) {
			throw new FS.ErrnoError(48); // ENOMEM
		}

		// Read the file contents into the allocated memory
		const bytesRead = stream.stream_ops.read(
			stream,
			runtime.HEAPU8,
			ptr,
			length,
			position
		);

		// If we read fewer bytes than requested, zero-fill the rest
		if (bytesRead < length) {
			runtime.HEAPU8.fill(0, ptr + bytesRead, ptr + length);
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
	// CJS and the imported symbols will different in the production build.
	const __private__symbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];
	for (const path of paths) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		// @ts-ignore
		replica[__private__symbol].FS.mount(
			// @ts-ignore
			replica[__private__symbol].PROXYFS,
			{
				root: path,
				// @ts-ignore
				fs: sourceOfTruth[__private__symbol].FS,
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
