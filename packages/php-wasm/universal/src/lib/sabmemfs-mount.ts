/**
 * Mount handler that integrates SABMEMFS with PHP.mount().
 *
 * Usage:
 *
 *   const buffers = createSABMemFSBuffers();
 *   await php.mount('/wordpress', sabMemFSMount(buffers));
 *
 * To share the same filesystem with another worker, pass the same
 * `buffers` object (the SharedArrayBuffer references survive
 * structured-clone / postMessage).
 */

import type { PHP, MountHandler } from './php';
import type { SABMemFSBuffers } from './sabmemfs';
import type { SharedSABFSOptions } from './sabmemfs';
import { SharedSABFS } from './sabmemfs';

export { createSABMemFSBuffers } from './sabmemfs';
export type { SABMemFSBuffers } from './sabmemfs';
export type { SharedSABFSOptions } from './sabmemfs';

/**
 * Create a MountHandler that mounts SABMEMFS at the given path.
 *
 * The returned function can be passed directly to `php.mount()`.
 *
 * @param buffers The shared metadata + data buffers.
 * @param options Optional configuration (e.g. multiWorker mode).
 */
export function sabMemFSMount(
	buffers: SABMemFSBuffers,
	options: SharedSABFSOptions = {}
): MountHandler {
	return async function mountSABMemFS(php: PHP, FS: any, vfsMountPoint: string) {
		// Pass the Emscripten runtime reference through mount opts so that
		// mmap can call _malloc / _free on the correct module instance.
		const __private__symbol = Object.getOwnPropertySymbols(php)[0];
		// @ts-ignore — accessing the private runtime for the Emscripten module
		const runtime = php[__private__symbol];

		const sabfs = SharedSABFS(FS, buffers, options);
		FS.mount(sabfs, { __runtime: runtime }, vfsMountPoint);

		return () => {
			FS.unmount(vfsMountPoint);
		};
	};
}
