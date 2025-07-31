import Semaphore, { AcquireTimeoutError } from './semaphore';
export { Semaphore, AcquireTimeoutError };
export { PhpWasmError } from './php-wasm-error';
export type { SemaphoreOptions } from './semaphore';
export {
	dirname,
	joinPaths,
	basename,
	normalizePath,
	isParentOf,
} from './paths';
export { createSpawnHandler } from './create-spawn-handler';
export { randomString } from './random-string';
export { randomFilename } from './random-filename';
export { WritablePolyfill, type WritableOptions } from './writable-polyfill';
export { EventEmitterPolyfill } from './event-emitter-polyfill';
export * from './php-vars';

export * from './sprintf';

export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	arrays.forEach((a) => (totalLength += a.length));
	const result = new Uint8Array(totalLength);
	let offset = 0;
	arrays.forEach((a) => {
		result.set(a, offset);
		offset += a.length;
	});
	return result;
}

export function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
	return concatUint8Arrays(buffers.map((b) => new Uint8Array(b)))
		.buffer as ArrayBuffer;
}

export * from './types';
