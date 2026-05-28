import Semaphore, { AcquireTimeoutError } from './semaphore';
import { concatUint8Arrays } from './concat-uint8-arrays';
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
export { concatUint8Arrays } from './concat-uint8-arrays';
export {
	decodeBase64ToString,
	decodeBase64ToUint8Array,
	encodeStringAsBase64,
	encodeUint8ArrayAsBase64,
} from './base64';
export { WritablePolyfill, type WritableOptions } from './writable-polyfill';
export { EventEmitterPolyfill } from './event-emitter-polyfill';
export { SmtpSinkWebSocket } from './smtp-sink-websocket';
export * from './php-vars';
export * from './smtp';

export * from './sprintf';

export function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
	return concatUint8Arrays(buffers.map((b) => new Uint8Array(b)))
		.buffer as ArrayBuffer;
}
