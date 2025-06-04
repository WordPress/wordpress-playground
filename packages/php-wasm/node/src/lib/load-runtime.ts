import type {
	SupportedPHPVersion,
	EmscriptenOptions,
	PHPRuntime,
} from '@php-wasm/universal';
import { loadPHPRuntime, FSHelpers } from '@php-wasm/universal';
import fs from 'fs';
import { getPHPLoaderModule } from '.';
import { withNetworking } from './networking/with-networking';
import { withICUData } from './data/with-icu-data';
import { joinPaths } from '@php-wasm/util';

export interface PHPLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	followSymlinks?: boolean;
}

/**
 * Does what load() does, but synchronously returns
 * an object with the PHP instance and a promise that
 * resolves when the PHP instance is ready.
 *
 * @see load
 */
export async function loadNodeRuntime(
	phpVersion: SupportedPHPVersion,
	options: PHPLoaderOptions = {}
) {
	const emscriptenOptions: EmscriptenOptions = {
		/**
		 * Emscripten default behavior is to kill the process when
		 * the WASM program calls `exit()`. We want to throw an
		 * exception instead.
		 */
		quit: function (code, error) {
			throw error;
		},
		...(options.emscriptenOptions || {}),
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
			 * The directory is mounted to the `/internals/symlinks` directory to avoid
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
					const symlinkPath = joinPaths(
						`/internals/symlinks`,
						absoluteSourcePath
					);
					if (
						!FSHelpers.fileExists(phpRuntime.FS, symlinkPath) &&
						fs.existsSync(absoluteSourcePath)
					) {
						phpRuntime.FS.mkdirTree(symlinkPath);
						phpRuntime.FS.mount(
							phpRuntime.FS.filesystems.NODEFS,
							{ root: absoluteSourcePath },
							symlinkPath
						);
					}
					return symlinkPath;
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
	return await loadPHPRuntime(
		await getPHPLoaderModule(phpVersion),
		await withNetworking(emscriptenOptions),
		await withICUData(emscriptenOptions)
	);
}
