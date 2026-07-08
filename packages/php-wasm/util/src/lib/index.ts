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
export { randomString } from './random-string';
export { randomFilename } from './random-filename';
export { splitShellCommand } from './split-shell-command';
export { concatArrayBuffers, concatUint8Arrays } from './concat-bytes';
export {
	decodeBase64ToString,
	decodeBase64ToUint8Array,
	encodeStringAsBase64,
	encodeUint8ArrayAsBase64,
} from './base64';
export { WritablePolyfill, type WritableOptions } from './writable-polyfill';
export { EventEmitterPolyfill } from './event-emitter-polyfill';
export * from './php-vars';
export {
	DEFAULT_SMTP_MAX_SIZE,
	SmtpSink,
	makeLoopbackPair,
	type AuthValidator,
	type ByteDuplex,
	type CaughtAttachment,
	type CaughtMessage,
	type SaslMechanism,
	type SmtpSinkOptions,
} from './smtp';

export * from './sprintf';
