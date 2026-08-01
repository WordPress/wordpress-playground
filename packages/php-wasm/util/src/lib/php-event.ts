/**
 * Explicitly marks an event whose `stdin` ReadableStream needs an independent
 * branch per listener and must be transferred across worker boundaries. The
 * global symbol registry keeps the marker stable if this package is loaded
 * more than once in the same realm.
 */
export const phpEventStdinTransfer = Symbol.for(
	'@php-wasm/php-event-stdin-transfer'
);

export type PHPEventWithStdinTransfer = {
	type: string;
	stdin: ReadableStream<Uint8Array>;
	[phpEventStdinTransfer]: true;
};
