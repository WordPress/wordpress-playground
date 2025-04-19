import { PHP } from '@php-wasm/universal';
import { SharedSABFS } from './sab';

// ───────────────── convenience helper ─────────────────
export type SharedFSBuffers = {
	metaBuf: SharedArrayBuffer;
	dataBuf: SharedArrayBuffer;
};
export const createSharedFSBuffers = (
	metaBytes = 16 << 20,
	dataBytes = 128 << 20
): SharedFSBuffers => ({
	metaBuf: new SharedArrayBuffer(metaBytes),
	dataBuf: new SharedArrayBuffer(dataBytes),
});

export function sharedArrayBufferMount(buffers: SharedFSBuffers) {
	return async function (php: PHP, FS: any, vfsMountPoint: string) {
		const sabfs = SharedSABFS(FS, buffers.metaBuf, buffers.dataBuf);
		FS.mount(sabfs, {}, vfsMountPoint);

		return () => {
			FS!.unmount(vfsMountPoint);
		};
	};
}
