/**
 * Temp dir helper for `--experimental-posix-kernel` mode.
 *
 * The kernel hands every fs path to its Node-side bridge
 * (`NodePlatformIO.rewritePath`) before calling `fs.*`. On Windows
 * that bridge translates `/<drive>/...` back to `<drive>:/...`, so
 * the CLI exposes two views of every directory it asks the kernel
 * to touch:
 *
 *   hostPath:   native path used for our own Node `fs.{mkdir,write,…}Sync`.
 *               e.g. `C:\Users\runner\AppData\Local\Temp\xyz`.
 *   kernelPath: POSIX-shaped path handed to kernel-resident programs
 *               (nginx -p, php-fpm -y, argv, nginx.conf template
 *               substitutions). e.g. `/C/Users/runner/AppData/Local/Temp/xyz`.
 *
 * On macOS/Linux `kernelPath === hostPath` because `toPosixPath` is a
 * no-op for already-POSIX paths.
 */

import {
	dir as tmpDir,
	setGracefulCleanup as tmpSetGracefulCleanup,
} from 'tmp-promise';
import { toPosixPath } from '@php-wasm/util';

export interface PosixKernelTempDir {
	hostPath: string;
	kernelPath: string;
	cleanup: () => Promise<void>;
}

export async function createPosixKernelTempDir(): Promise<PosixKernelTempDir> {
	const nativeDir = await tmpDir({
		prefix: `playground-cli-posix-kernel-${process.pid}-`,
		unsafeCleanup: true,
	});
	tmpSetGracefulCleanup();

	return {
		hostPath: nativeDir.path,
		kernelPath: toPosixPath(nativeDir.path),
		cleanup: () => nativeDir.cleanup(),
	};
}
