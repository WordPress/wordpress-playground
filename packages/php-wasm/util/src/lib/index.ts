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
	ensureAbsolutePath,
	toPosixPath,
} from './paths';
export { createSpawnHandler } from './create-spawn-handler';
export { createSendmailSpawnHandler } from './create-sendmail-handler';
export { randomString } from './random-string';
export { randomFilename } from './random-filename';
export { splitShellCommand } from './split-shell-command';
export {
	decodeBase64ToString,
	decodeBase64ToUint8Array,
	encodeStringAsBase64,
	encodeUint8ArrayAsBase64,
} from './base64';
export { WritablePolyfill, type WritableOptions } from './writable-polyfill';
export { EventEmitterPolyfill } from './event-emitter-polyfill';
export { WebSocketShim } from './websocket-shim';
export { SmtpSinkWebSocket } from './smtp-sink-websocket';
export * from './php-vars';
export * from './smtp';

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
