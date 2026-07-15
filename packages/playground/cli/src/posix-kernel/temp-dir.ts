import { randomBytes } from 'node:crypto';
import {
	dir as tmpDir,
	setGracefulCleanup as tmpSetGracefulCleanup,
} from 'tmp-promise';

/**
 * `hostPath` is the native path (used by `fs.*`); `kernelPath` lives
 * under `/tmp/...`, a dir present in kandelo's rootfs.vfs, and is
 * routed back to `hostPath` by extraMounts.
 */
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

	const kernelPath = `/tmp/playground-cli-posix-kernel-${process.pid}-${randomBytes(8).toString('hex')}`;

	return {
		hostPath: nativeDir.path,
		kernelPath,
		cleanup: () => nativeDir.cleanup(),
	};
}
