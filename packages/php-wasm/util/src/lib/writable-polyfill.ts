/**
 * Polyfills Node.js WritableStream API. The main goal is to enable
 * using a child_process.spawn()-like API in both Node.js and the browser.
 *
 * @see https://nodejs.org/api/stream.html#stream_writable_end_chunk_encoding_callback
 */
import { EventEmitterPolyfill } from './event-emitter-polyfill';

export interface WritableOptions {
	highWaterMark?: number;
	decodeStrings?: boolean;
	defaultEncoding?: BufferEncoding;
	write: (chunk: any, encoding: BufferEncoding, cb: WriteCallback) => void;
}

export type WriteCallback = (error?: Error | null) => void;

export class WritablePolyfill extends EventEmitterPolyfill {
	private buffer: Array<{
		chunk: any;
		encoding: BufferEncoding;
		cb: WriteCallback;
	}> = [];
	private writing = false;
	public ended = false;
	private length = 0;
	private highWaterMark: number;
	private decodeStrings: boolean;
	private defaultEncoding: BufferEncoding;
	private defer: (fn: () => void) => void;
	private _write: (
		chunk: any,
		encoding: BufferEncoding,
		cb: WriteCallback
	) => void;

	constructor(opts: WritableOptions) {
		super();
		if (!opts.write) {
			throw new Error('WritablePolyfill requires write option');
		}
		this._write = opts.write;
		this.highWaterMark = opts.highWaterMark ?? 16 * 1024;
		this.decodeStrings = opts.decodeStrings ?? true;
		this.defaultEncoding = opts.defaultEncoding ?? 'utf8';
		// queueMicrotask keeps browser support; fallback for older environments.
		this.defer =
			typeof queueMicrotask === 'function'
				? queueMicrotask
				: (fn) => setTimeout(fn, 0);
	}

	write(
		chunk: any,
		encoding: BufferEncoding | WriteCallback = this.defaultEncoding,
		cb: WriteCallback = () => {}
	): boolean {
		if (typeof encoding === 'function') {
			cb = encoding as WriteCallback;
			encoding = this.defaultEncoding;
		}

		if (this.ended) {
			const err = new Error('write after end');
			// We can't call this.defer() directly. If this.defer is
			// `queueMicrotask`, a `this.defer()` call will pass the
			// WritablePolyfill instance as `this` argument and cause
			// the browser to throw an error similar to "Invalid
			// invocation".
			const defer = this.defer;
			defer(() => cb(err));
			this.emit('error', err);
			return false;
		}

		if (this.decodeStrings && typeof chunk === 'string') {
			if (
				typeof Buffer !== 'undefined' &&
				typeof (Buffer as any).from === 'function'
			) {
				chunk = Buffer.from(chunk, encoding as BufferEncoding);
			} else if (typeof TextEncoder !== 'undefined') {
				chunk = new TextEncoder().encode(chunk);
			} else {
				throw new Error(
					'String chunks are not supported in this environment: Buffer and TextEncoder are unavailable.'
				);
			}
			encoding = 'buffer' as BufferEncoding;
		}

		this.length += chunk.length ?? 1;
		const needDrain = this.length >= this.highWaterMark;

		this.buffer.push({ chunk, encoding: encoding as BufferEncoding, cb });

		if (!this.writing) this._clearBuffer();

		return !needDrain;
	}

	end(
		chunk?: any,
		encoding?: BufferEncoding | WriteCallback,
		cb?: WriteCallback
	): void {
		if (typeof chunk === 'function') {
			cb = chunk;
			chunk = undefined;
		} else if (typeof encoding === 'function') {
			cb = encoding as WriteCallback;
			encoding = undefined;
		}

		if (chunk !== undefined)
			this.write(chunk, encoding as BufferEncoding, () => {});
		this.ended = true;
		if (!this.writing) this._clearBuffer();
		if (cb) this.defer(cb);
	}

	// Stubs kept for API parity; add logic if you depend on corking.
	cork(): void {}
	uncork(): void {}

	setDefaultEncoding(enc: BufferEncoding): this {
		this.defaultEncoding = enc;
		return this;
	}

	private _clearBuffer(): void {
		const entry = this.buffer.shift();
		if (!entry) {
			if (this.ended) this.emit('finish');
			return;
		}

		this.writing = true;
		this._write(entry.chunk, entry.encoding, (err?: Error | null) => {
			this.writing = false;
			this.length -= entry.chunk.length ?? 1;
			if (err) this.emit('error', err);
			entry.cb(err);

			if (this.buffer.length) {
				this._clearBuffer();
			} else {
				if (this.length < this.highWaterMark) this.emit('drain');
				if (this.ended) this.emit('finish');
			}
		});
	}
}
