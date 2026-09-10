import { randomBytes } from 'node:crypto';
import {
	dir as tmpDir,
	setGracefulCleanup as tmpSetGracefulCleanup,
} from 'tmp-promise';

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
