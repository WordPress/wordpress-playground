import { currentJsRuntime } from './current-js-runtime';

// Without this check, the polyfills below would also be applied
// in web browsers. Unfortunately, Safari doesn't sypport BYOB streams
// and doesn't support the polyfill provided here. Let's only apply
// those polyfills in Node.js environments.
if (currentJsRuntime === 'NODE') {
	/**
	 * WordPress Playground heavily realies on the File class. This module
	 * polyfill the File class for the different environments where
	 * WordPress Playground may run.
	 */
	if (typeof File === 'undefined') {
		/**
		 * Polyfill the File class that isn't shipped in Node.js version 18.
		 *
		 * Blob conveniently provides a lot of the same methods as File, we
		 * just need to implement a few File-specific properties.
		 */
		class File extends Blob {
			override readonly name;
			readonly lastModified: number;
			readonly lastModifiedDate: Date;
			webkitRelativePath: any;
			constructor(
				sources: BlobPart[],
				fileName: string,
				options?: FilePropertyBag
			) {
				super(sources);
				/*
				 * Compute a valid last modified date as that's what the
				 * browsers do:
				 *
				 * ```
				 * > new File([], '').lastModifiedDate
				 * Sat Dec 16 2023 10:07:53 GMT+0100 (czas środkowoeuropejski standardowy)
				 *
				 * > new File([], '', { lastModified: NaN }).lastModifiedDate
				 * Thu Jan 01 1970 01:00:00 GMT+0100 (czas środkowoeuropejski standardowy)
				 *
				 * > new File([], '', { lastModified: 'string' }).lastModifiedDate
				 * Thu Jan 01 1970 01:00:00 GMT+0100 (czas środkowoeuropejski standardowy)
				 *
				 * > new File([], '', { lastModified: {} }).lastModifiedDate
				 * Thu Jan 01 1970 01:00:00 GMT+0100 (czas środkowoeuropejski standardowy)
				 * ```
				 */
				let date;
				if (options?.lastModified) {
					date = new Date();
				}
				if (!date || isNaN(date.getFullYear())) {
					date = new Date();
				}
				this.lastModifiedDate = date;
				this.lastModified = date.getMilliseconds();
				this.name = fileName || '';
			}
		}
		global.File = File;
	}

	// eslint-disable-next-line no-inner-declarations
	function asPromise<T>(obj: FileReader) {
		return new Promise<T>(function (resolve, reject) {
			obj.onload = obj.onerror = function (event: Event) {
				obj.onload = obj.onerror = null;

				if (event.type === 'load') {
					resolve(obj.result as T);
				} else {
					reject(new Error('Failed to read the blob/file'));
				}
			};
		});
	}

	/**
	 * File is a subclass of Blob. Let's polyfill the following Blob
	 * methods that are missing in JSDOM:
	 *
	 * – Blob.text()
	 * – Blob.stream()
	 * – Blob.arrayBuffer()
	 *
	 * See the related JSDom issue:
	 *
	 * – [Implement Blob.stream, Blob.text and Blob.arrayBuffer](https://github.com/jsdom/jsdom/issues/2555).
	 *
	 * @source `blob-polyfill` npm package.
	 * * By Eli Grey, https://eligrey.com
	 * * By Jimmy Wärting, https://github.com/jimmywarting
	 */
	if (typeof Blob.prototype.arrayBuffer === 'undefined') {
		Blob.prototype.arrayBuffer = function arrayBuffer() {
			const reader = new FileReader();
			reader.readAsArrayBuffer(this);
			return asPromise<Uint8Array>(reader);
		};
	}

	if (typeof Blob.prototype.text === 'undefined') {
		Blob.prototype.text = function text() {
			const reader = new FileReader();
			reader.readAsText(this);
			return asPromise<string>(reader);
		};
	}

	/**
	 * Detects if BYOB (Bring Your Own Buffer) streams are supported
	 * in the current environment.
	 *
	 * BYOB is a new feature in the Streams API that allows reading
	 * an arbitrary number of bytes from a stream. It's not supported
	 * in older versions of Node.js.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamBYOBReader
	 */
	// eslint-disable-next-line no-inner-declarations
	function isByobSupported() {
		const inputBytes = new Uint8Array([1, 2, 3, 4]);
		const file = new File([inputBytes], 'test');
		const stream = file.stream();
		try {
			// This throws on older versions of node:
			stream.getReader({ mode: 'byob' });
			return true;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Polyfill the stream() method if it either doesn't exist,
	 * or is an older version shipped with e.g. Node.js 18 where
	 * BYOB streams seem to be unsupported.
	 */
	if (typeof Blob.prototype.stream === 'undefined' || !isByobSupported()) {
		Blob.prototype.stream = function () {
			let position = 0;
			// eslint-disable-next-line
			const blob = this;
			return new ReadableStream({
				type: 'bytes',
				// 0.5 MB seems like a reasonable chunk size, let's adjust
				// this if needed.
				autoAllocateChunkSize: 512 * 1024,

				async pull(controller) {
					const view = controller.byobRequest!.view;

					// Read the next chunk of data:
					const chunk = blob.slice(
						position,
						position + view!.byteLength
					);
					const buffer = await chunk.arrayBuffer();
					const uint8array = new Uint8Array(buffer);

					// Emit that chunk:
					new Uint8Array(view!.buffer).set(uint8array);
					const bytesRead = uint8array.byteLength;
					controller.byobRequest!.respond(bytesRead);

					// Bump the position and close this stream once
					// we've read the entire blob.
					position += bytesRead;
					if (position >= blob.size) {
						controller.close();
					}
				},
			});
		};
	}
}

export default {};
