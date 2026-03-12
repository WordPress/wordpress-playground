import {
	type SupportedPHPVersion,
	type EmscriptenOptions,
	type PHPRuntime,
	type FileLockManager,
	loadPHPRuntime,
	FSHelpers,
	FileLockManagerComposite,
	ProcessIdAllocator,
} from '@php-wasm/universal';
import type { WasmUserSpaceAPI, WasmUserSpaceContext } from './wasm-user-space';
import { bindUserSpace } from './wasm-user-space';
import fs from 'fs';
import { getPHPLoaderModule } from '.';
import { FileLockManagerForPosix } from './file-lock-manager-for-posix';
import { FileLockManagerForWindows } from './file-lock-manager-for-windows';
import { withNetworking } from './networking/with-networking';
import {
	withXdebug,
	type XdebugOptions,
} from './extensions/xdebug/with-xdebug';
import { withIntl } from './extensions/intl/with-intl';
import { withRedis } from './extensions/redis/with-redis';
import { withMemcached } from './extensions/memcached/with-memcached';
import { dirname, joinPaths, toPosixPath } from '@php-wasm/util';
import { platform } from 'os';

export interface PHPLoaderOptions {
	followSymlinks?: boolean;
	withXdebug?: boolean | XdebugOptions;
	withIntl?: boolean;
	withRedis?: boolean;
	withMemcached?: boolean;
}

export type PHPLoaderOptionsForNode = PHPLoaderOptions & {
	/**
	 * A file lock manager to coordinate file locks between
	 * multiple php-wasm instances and other OS processes.
	 */
	fileLockManager?: FileLockManager;
	emscriptenOptions?: EmscriptenOptions & {
		/**
		 * The process ID for the PHP runtime.
		 *
		 * This is used to distinguish between php-wasm processes for the
		 * purpose of file locking and more informative trace messages.
		 *
		 * This ID is optional when running a single php-wasm process.
		 */
		processId?: number;

		/**
		 * Factory called during WASM initialization to create
		 * user-space syscall implementations (flock, fcntl, etc.)
		 * for a PHP process. Receives process context (PID,
		 * constants, errno codes) and returns the bound syscall
		 * functions.
		 */
		bindUserSpace?: (
			userSpaceContext: WasmUserSpaceContext
		) => WasmUserSpaceAPI;

		/**
		 * An optional function to collect trace messages.
		 *
		 * @param processId - The process ID of the PHP runtime.
		 * @param format - A printf-style format string.
		 * @param args - Arguments to the format string.
		 */
		trace?: (processId: number, format: string, ...args: any[]) => void;

		/**
		 * An optional path used to a real, native directory
		 * to be mounted as the php-wasm /internal directory.
		 */
		nativeInternalDirPath?: string;
	};
};

/**
 * In order to make loadNodeRuntime easier to use in testing,
 * we provide default processIds for runtimes when none was provided.
 * !! Do not assign default process IDs in production code.
 * Otherwise, runtimes in different worker threads might end
 * up with the same process ID, which could break file locking
 * and lead to database corruption.
 */
const dangerousDefaultProcessIdAllocator = (process.env as any).VITEST
	? new ProcessIdAllocator()
	: undefined;

/**
 * Does what load() does, but synchronously returns
 * an object with the PHP instance and a promise that
 * resolves when the PHP instance is ready.
 *
 * @see load
 */
export async function loadNodeRuntime(
	phpVersion: SupportedPHPVersion,
	options: PHPLoaderOptionsForNode = {}
) {
	const processId =
		options.emscriptenOptions?.processId ??
		// !! Only assign a default process ID during test.
		// Otherwise, multiple workers with duplicate process IDs
		// could break file locking and lead to database corruption.
		((process.env as any).VITEST
			? dangerousDefaultProcessIdAllocator!.claim()
			: undefined);

	let emscriptenOptions: EmscriptenOptions = {
		/**
		 * Emscripten default behavior is to kill the process when
		 * the WASM program calls `exit()`. We want to throw an
		 * exception instead.
		 */
		quit: function (code, error) {
			throw error;
		},
		bindUserSpace: (userSpaceContext: WasmUserSpaceContext) => {
			const nativeFileLockManager =
				platform() === 'win32'
					? new FileLockManagerForWindows()
					: new FileLockManagerForPosix();
			const fileLockManager = options.fileLockManager
				? new FileLockManagerComposite({
						nativeLockManager: nativeFileLockManager,
						wasmLockManager: options.fileLockManager,
					})
				: nativeFileLockManager;
			return bindUserSpace({ fileLockManager }, userSpaceContext);
		},
		...(options.emscriptenOptions || {}),
		processId,
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			/**
			 * When users mount a directory using the `mount` function,
			 * the directory becomes accessible in the Emscripten's filesystem.
			 * But if the directory contains symlinks to directories that
			 * are not mounted, the symlinks will not be accessible to Emscripten.
			 *
			 * To work around this, we intercept the `readlink` function and
			 * mount the OS directory on demand.
			 *
			 * If a link path is missing from the Emscripten's filesystem
			 * and the link path exists on the OS filesystem, create the directory
			 * in the Emscripten's filesystem and mount the OS directory
			 * to the Emscripten filesystem.
			 *
			 * The directory is mounted to the `/internal/symlinks` directory to avoid
			 * conflicts with existing VFS directories.
			 * We can set a arbitrary mount path because readlink is the source of truth
			 * for the path and Emscripten will accept it as if it was the real link path.
			 */
			if (options?.followSymlinks === true) {
				phpRuntime.FS.filesystems.NODEFS.node_ops.readlink = (
					node: any
				) => {
					const absoluteSourcePath =
						phpRuntime.FS.filesystems.NODEFS.tryFSOperation(() =>
							fs.realpathSync(
								phpRuntime.FS.filesystems.NODEFS.realPath(node)
							)
						);

					const normalizedPath = toPosixPath(absoluteSourcePath);
					const symlinkMountPath = joinPaths(
						`/internal/symlinks`,
						normalizedPath
					);
					if (fs.existsSync(absoluteSourcePath)) {
						const sourceStat = fs.statSync(absoluteSourcePath);
						if (
							!FSHelpers.fileExists(
								phpRuntime.FS,
								symlinkMountPath
							)
						) {
							if (sourceStat.isDirectory()) {
								phpRuntime.FS.mkdirTree(symlinkMountPath);
							} else if (sourceStat.isFile()) {
								phpRuntime.FS.mkdirTree(
									dirname(symlinkMountPath)
								);
								phpRuntime.FS.writeFile(symlinkMountPath, '');
							} else {
								throw new Error(
									'Unsupported file type. PHP-wasm supports only symlinks that link to files, directories, or symlinks.'
								);
							}
						}

						/**
						 * For file symlinks, mount the parent directory instead
						 * of just the file. When PHP resolves __DIR__ inside a
						 * mounted file, it gets the parent path — which would be
						 * an empty MEMFS directory if only the file were mounted.
						 * Mounting the parent directory ensures sibling files
						 * (e.g. wp-includes/version.php next to wp-load.php)
						 * are accessible.
						 *
						 * @TODO: Upward traversal beyond the parent directory
						 * (e.g. __DIR__ . '/../../') still lands in empty MEMFS
						 * scaffolding. We need to figure out how to mount enough
						 * of the host filesystem to support ../../ paths in the
						 * PHP files brought in through symlinks, without mounting
						 * the entire host root.
						 */
						const mountPath = sourceStat.isFile()
							? dirname(symlinkMountPath)
							: symlinkMountPath;
						const mountRoot = sourceStat.isFile()
							? dirname(normalizedPath)
							: absoluteSourcePath;

						const mountNode =
							phpRuntime.FS.lookupPath(mountPath).node;

						/**
						 * If another PHP instance has already resolved a symlink
						 * to the same absolute path, a corresponding mount point
						 * will exist in the shared filesystem, but we do not know
						 * whether the target path has been mounted to this PHP's
						 * VFS. If the VFS node at the mount path has its own path
						 * as the mount point, we know there is a mount there.
						 */
						const isMounted =
							mountNode.mount.mountpoint === mountPath;

						if (!isMounted) {
							phpRuntime.FS.mount(
								phpRuntime.FS.filesystems.NODEFS,
								{ root: mountRoot },
								mountPath
							);
						}
					}
					return symlinkMountPath;
				};
			}

			/**
			 * Emscripten automatically detects the filesystem for a given path,
			 * and because the root path always uses the MEMFS filesystem, `statfs`
			 * will return the default hardcoded value for MEMFS instead of the
			 * actual disk space.
			 *
			 * To ensure `statfs` works in the Node version of PHP-WASM,
			 * we need to add `statfs` from NODEFS to the root FS.
			 * Otherwise, `statfs` is undefined in the root FS and the NODEFS
			 * implementation wouldn't be used for paths that exist in MEMFS.
			 *
			 * The only place `statfs` is used in PHP are the `disk_total_space`
			 * and `disk_free_space` functions.
			 * Both functions return the disk space for a given disk partition.
			 * If a subdirectory is passed, the function will return the disk space
			 * for its partition.
			 */
			phpRuntime.FS.root.node_ops = {
				...phpRuntime.FS.root.node_ops,
				statfs: phpRuntime.FS.filesystems.NODEFS.node_ops.statfs,
			};

			/**
			 * By default FS.root node value of `mount.opts.root` is `undefined`.
			 * As a result `FS.lookupPath` will return a node with a `undefined`
			 * `mount.opts.root` path when looking up the `/` path using `FS.lookupPath`.
			 *
			 * The `NODEFS.realPath` function works with `undefined` because it uses
			 * `path.join` to build the path and for the `[undefined]` it will
			 * return the `.` path.
			 *
			 * Because the `node.mount.opts.root` path is `undefined`,
			 * `fs.statfsSync` will throw an error when trying to get the
			 * disk space for an undefined path.
			 * For the `/` path to correctly resolve, we must set the
			 * `mount.opts.root` path to the current working directory.
			 *
			 * We chose the current working directory over `/` because
			 * NODERAWFS defines the root path as `.`.
			 * Emscripten reference to setting the root path in NODERAWFS:
			 * https://github.com/emscripten-core/emscripten/pull/19400/files#diff-456b6256111c90ca5e6bdb583ab87108cd51cbbefc812c4785ea315c0728b3a8R11
			 */
			phpRuntime.FS.root.mount.opts.root = '.';
		},
	};

	if (options?.withXdebug) {
		emscriptenOptions = await withXdebug(
			phpVersion,
			emscriptenOptions,
			typeof options.withXdebug === 'object' ? options.withXdebug : {}
		);
	}

	if (options?.withIntl === true) {
		emscriptenOptions = await withIntl(phpVersion, emscriptenOptions);
	}

	if (options?.withRedis === true) {
		emscriptenOptions = await withRedis(phpVersion, emscriptenOptions);
	}

	if (options?.withMemcached === true) {
		emscriptenOptions = await withMemcached(phpVersion, emscriptenOptions);
	}

	emscriptenOptions = await withNetworking(emscriptenOptions);

	const phpLoaderModule = await getPHPLoaderModule(phpVersion);

	const runtimeId = await loadPHPRuntime(phpLoaderModule, emscriptenOptions);
	return runtimeId;
}
