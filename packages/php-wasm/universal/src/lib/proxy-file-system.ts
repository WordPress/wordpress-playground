import type { PHP } from './php';

/**
 * Adds mmap support to PROXYFS for memory-mapping files across PHP instances.
 *
 * Without mmap, libraries like ICU fail when accessing data files through PROXYFS.
 * ICU calls mmap to load icudt74l.dat when initializing Intl classes like Collator
 * and NumberFormatter. PROXYFS has no mmap implementation by default, causing these
 * calls to fail even when the data file exists in the proxied filesystem.
 *
 * This patches PROXYFS.stream_ops to add mmap and msync methods. The mmap implementation
 * allocates memory, reads the file through PROXYFS's existing read operations, and
 * returns a pointer to the allocated buffer—matching the behavior of POSIX mmap.
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
	 * Maps a file into memory by allocating a buffer and reading the file contents into it.
	 *
	 * PROXYFS has no direct access to the underlying file buffer, so we simulate mmap
	 * by allocating memory with malloc and copying the file contents through read operations.
	 *
	 * @param stream - The file stream to map
	 * @param length - Number of bytes to map (may be incorrect for non-.dat files in PHP 7.4)
	 * @param position - File offset to start mapping from (must be 0)
	 * @param prot - Memory protection flags (unused, we always allocate read/write)
	 * @param flags - Mapping flags (unused)
	 * @returns Object with ptr (pointer to allocated memory) and allocated flag
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

		// ICU only maps files from offset 0, so we don't support partial mapping
		if (position !== 0) {
			throw new FS.ErrnoError(22); // EINVAL
		}

		const ptr = runtime.malloc(length);
		if (!ptr) {
			throw new FS.ErrnoError(48); // ENOMEM
		}

		// Read the file into the allocated memory. Create a subarray view of the heap
		// so read operations write directly to the correct memory location without
		// needing offset calculations.
		const heap = runtime.HEAPU8.subarray(ptr, ptr + length);
		let totalBytesRead = 0;

		while (totalBytesRead < length) {
			const bytesRead = stream.stream_ops.read(
				stream,
				heap,
				totalBytesRead,
				length - totalBytesRead,
				totalBytesRead
			);

			if (bytesRead <= 0) break;
			totalBytesRead += bytesRead;
		}

		// Partial reads indicate I/O errors or premature EOF
		if (totalBytesRead !== length) {
			runtime.free(ptr);
			throw new FS.ErrnoError(5); // EIO
		}

		return { ptr: ptr, allocated: true };
	};

	/**
	 * Writes memory-mapped changes back to the file when the mapping is shared.
	 *
	 * Called by munmap to persist changes made to the mapped memory region.
	 * MAP_PRIVATE mappings (flag bit 2) keep changes in memory only, while
	 * MAP_SHARED mappings write changes back to the underlying file.
	 *
	 * ICU only reads from its data files, so this rarely gets called in practice.
	 *
	 * @param stream - The file stream
	 * @param buffer - The memory buffer containing changes
	 * @param offset - Offset in the buffer
	 * @param length - Number of bytes to sync
	 * @param mmapFlags - Flags from the original mmap call
	 * @returns 0 on success
	 */
	PROXYFS.stream_ops.msync = function (
		stream: any,
		buffer: Uint8Array,
		offset: number,
		length: number,
		mmapFlags: number
	) {
		// MAP_PRIVATE (flag bit 2) means changes stay in memory
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
 * Mounts directories from one PHP instance's filesystem into another using PROXYFS.
 *
 * This enables file sharing between PHP instances without duplicating the files in memory.
 * For example, mounting /wordpress from the parent instance into a child worker allows
 * both to access the same WordPress installation without copying the entire directory.
 *
 * The function automatically patches PROXYFS with mmap support before mounting, ensuring
 * libraries like ICU can memory-map data files through the proxied filesystem.
 *
 * Mounts are registered via php.mount() so they survive runtime rotation.
 * When the replica's WASM module is hot-swapped, hotSwapPHPRuntime()
 * re-applies these mount handlers on the fresh module.
 *
 * @param sourceOfTruth - The PHP instance containing the original files
 * @param replica - The PHP instance that will access files through PROXYFS
 * @param paths - Absolute paths to mount (e.g., ['/wordpress', '/internal/shared'])
 */
export async function proxyFileSystem(
	sourceOfTruth: PHP,
	replica: PHP,
	paths: string[]
) {
	// We can't just import the symbol from the library because
	// Playground CLI is built as ESM and php-wasm-node is built as
	// CJS and the imported symbols will differ in the production build.
	const sourceSymbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];
	for (const path of paths) {
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		// Register via php.mount() so the mount handler is re-applied
		// after runtime rotation in hotSwapPHPRuntime().
		replica.mkdir(path);
		await replica.mount(path, (php: PHP) => {
			ensureProxyFSHasMmapSupport(php);
			const replicaSymbol = Object.getOwnPropertySymbols(php)[0];
			// @ts-ignore
			php[replicaSymbol].FS.mount(
				// @ts-ignore
				php[replicaSymbol].PROXYFS,
				{
					root: path,
					// @ts-ignore
					fs: sourceOfTruth[sourceSymbol].FS,
				},
				path
			);
			return () => {
				try {
					// @ts-ignore
					php[replicaSymbol].FS.unmount(path);
				} catch {
					// Ignore unmount errors during cleanup
				}
			};
		});
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
