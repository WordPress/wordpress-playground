import { collectBytes } from './utils/collect-bytes';
import { limitBytes } from './utils/limit-bytes';
import { decodeZip, nextZipEntry } from './zip/decode-zip';

function areByobStreamsSupported() {
	return (
		typeof ReadableStreamBYOBReader !== 'undefined' &&
		typeof ReadableStreamBYOBRequest !== 'undefined'
	);
}

/**
 * Safari does not support BYOB streams, so we need to polyfill them.
 */
if (!areByobStreamsSupported()) {
	// Bring spec-compliant streams to global scope
	const streams = await import('web-streams-polyfill/ponyfill');
	for (const [key, value] of Object.entries(streams)) {
		(globalThis as any)[key] = value;
	}

	function bufferToStream(buffer) {
		const newArray = new Uint8Array(buffer.byteLength);
		newArray.set(new Uint8Array(buffer));
		buffer = newArray;
		return new ReadableStream({
			type: 'bytes',
			// 0.5 MB seems like a reasonable chunk size, let's adjust
			// this if needed.
			autoAllocateChunkSize: Math.max(
				1,
				Math.min(buffer.byteLength, 512 * 1024)
			),
			/**
			 * We could write directly to controller.byobRequest.view
			 * here. Unfortunately, in Chrome it detaches on the first
			 * `await` and cannot be reused once we actually have the data.
			 */
			async pull(controller) {
				// Read data until we have enough to fill the BYOB request:
				const view = controller.byobRequest!.view!;
				const uint8array = new Uint8Array(view.byteLength);
				uint8array.set(buffer.slice(0, uint8array.byteLength));
				buffer = buffer.slice(uint8array.byteLength);

				// Emit that chunk:
				controller.byobRequest?.respondWithNewView(uint8array);
				if (buffer.byteLength === 0 || view.byteLength === 0) {
					controller.close();
					controller.byobRequest?.respond(0);
				}
			},
		});
	}

	const _fetchBackup = (globalThis as any).fetch;
	(globalThis as any).fetch = async function (...args): Promise<Response> {
		console.log({ args });
		if (args[0].includes('.wasm')) {
			return _fetchBackup(...args);
		}
		console.log('Getch called');
		const response = await _fetchBackup(...args);
		const responseBuffer = await response.arrayBuffer();
		console.log('Got response', { responseBuffer });
		// console.log(response.headers);
		return new ByobResponse(bufferToStream(responseBuffer), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};

	class ByobResponse extends Response {
		constructor(bodyInit: BodyInit | null, init?: ResponseInit) {
			super(bodyInit, init);
			this._bodyStream = bodyInit;
		}
		override get body() {
			return this._bodyStream;
		}
		override arrayBuffer() {
			return collectBytes(this._bodyStream);
		}
	}

	const OriginalDecompressionStream = (globalThis as any).DecompressionStream;
	(globalThis as any).DecompressionStream = class DecompressionStream2 {
		constructor(algorithm: string, opts?: DecompressionStreamInit) {
			const stream = new OriginalDecompressionStream(algorithm, opts);
			const writer = stream.writable.getWriter();
			const reader = stream.readable.getReader();
			this.writable = new WritableStream({
				write(chunk) {
					writer.write(chunk);
				},
				close() {
					writer.releaseLock();
					stream.writable.close();
				},
				abort() {
					stream.writable.abort();
				},
			});
			this.readable = new ReadableStream({
				type: 'bytes',
				// 0.5 MB seems like a reasonable chunk size, let's adjust
				// this if needed.
				autoAllocateChunkSize: 1024,
				async pull(controller) {
					const { value, done } = await reader.read();
					if (done) {
						reader.releaseLock();
						controller.close();
						return;
					}
					controller.enqueue(value);
				},
				cancel() {
					reader.cancel();
				},
			});
		}
	};
	// const resp = aw ait window.fetch('https://downloads.wordpress.org/theme/pendant.latest-stable.zip');
	// console.log(await collectBytes(resp.body));
	// const ua = new Uint8Array(4);
	// try {
	// 	console.log(
	// 		await resp
	// 			.body
	// 			.getReader({ mode: 'byob' })
	// 			.read(ua)
	// 			.then(({ value }) => value!)
	// 	);
	// } catch (e) {
	// 	console.trace(e)
	// }
	// console.log(await collectBytes(limitBytes(resp.body, 4)));
	// console.log(await collectBytes(resp.body, 4));
	// try {
	// 	for await (const entry of decodeZip(resp.body!, () => true)) {
	// 		console.log({ entry })
	// 	}
	// 	console.log("Finished?")
	// } catch (e) {
	// 	console.trace(e);
	// }
	// const entry = await nextZipEntry(resp.body!);
	// console.log({ entry });
	// throw new Error();
	// const ab = await resp.arrayBuffer();
	// // const ab2 = await collectBytes(stream2);
	// // console.log({ ab, ab2 });
	// // console.log(new Uint8Array(ab)[25]);
	// // console.log(new Uint8Array(ab2)[25]);

	// const resp2 = new ByobResponse(bufferToStream(ab), {
	// 	status: 200,
	// 	statusText: 'OK',
	// });
	// console.log(resp2.body);
	// // const ab3 = await resp2.arrayBuffer();
	// const ab3 = await collectBytes(resp2.body);
	// // console.log('ab3.byteLength', ab3.byteLength);
	// console.log(ab3[25]);

	// const stream = (await window.fetch('/website-server/index.html')).body;
	// console.log(await collectBytes(stream!));
	// console.log(await collectBytes(limitBytes(stream!, 10)));
	// // throw new Error();
	// console.log(
	// 	await stream
	// 		?.getReader({ mode: 'byob' })
	// 		.read(new Uint8Array(200))
	// );
	// (globalThis as any).fetch = async function fetch(
	// 	input: RequestInfo,
	// 	init?: RequestInit
	// ): Promise<Response> {
	// 	const response = await (globalThis as any).fetch(input, init);
	// 	response.bo;
	// 	const body = await response.arrayBuffer();
	// 	return new Response(body, response);
	// };
	// Add support for BYOB streams to ReadableStream
	// const _getReader = ReadableStream.prototype.getReader;
	// ReadableStream.prototype.getReader = function getReader(options: any) {
	// 	if (options && options.mode === 'byob' && !isStreamByob(this)) {
	// 		return _getReader.call(streamToByobStream(this), options);
	// 	}
	// 	return _getReader.call(this, options);
	// };

	// const _pipeTo = ReadableStream.prototype.pipeTo;
	// ReadableStream.prototype.pipeTo = function (target, options) {
	// 	if (isStreamByob(this)) {
	// 		return _pipeTo.call(streamToByobStream(this), target, options);
	// 	}
	// 	return _pipeTo.call(this, target, options);
	// };

	// const _pipeThrough = ReadableStream.prototype.pipeThrough;
	// ReadableStream.prototype.pipeThrough = function (target, options) {
	// 	if (isStreamByob(this)) {
	// 		return _pipeThrough.call(streamToByobStream(this), target, options);
	// 	}
	// 	return _pipeThrough.call(this, target, options);
	// };

	function isStreamByob(stream: ReadableStream) {
		try {
			const reader = stream.getReader({ mode: 'byob' });
			reader.cancel();
			return true;
		} catch (e) {
			return false;
		}
	}
}

// Make this file a module
export {};
