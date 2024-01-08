import { collectBytes } from './utils/collect-bytes';

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
		return new ReadableStream({
			type: 'bytes',
			// 0.5 MB seems like a reasonable chunk size, let's adjust
			// this if needed.
			autoAllocateChunkSize: 512 * 1024,
			/**
			 * We could write directly to controller.byobRequest.view
			 * here. Unfortunately, in Chrome it detaches on the first
			 * `await` and cannot be reused once we actually have the data.
			 */
			async pull(controller) {
				// Read data until we have enough to fill the BYOB request:
				const view = controller.byobRequest!.view!;
				const uint8array = new Uint8Array(view.byteLength);
				uint8array.set(buffer);
				buffer = buffer.slice(uint8array.byteLength);
				console.log(
					'Pull',
					{ uint8array, buf: buffer },
					view.byteLength
				);

				// Emit that chunk:
				controller.byobRequest?.respondWithNewView(uint8array);
				if (buffer.byteLength === 0) {
					controller.close();
					controller.byobRequest?.respond(0);
				}
			},
		});
	}

	class ByobResponse extends Response {
		constructor(arrayBuffer: BodyInit | null, init?: ResponseInit) {
			const _bodyStream = bufferToStream(arrayBuffer);
			super(_bodyStream, init);
			this._bodyStream = _bodyStream;
		}
		override get body() {
			return this._bodyStream;
		}
	}

	const _fetchBackup = (globalThis as any).fetch;
	(globalThis as any).fetch = async function (...args): Promise<Response> {
		console.log({ args });
		if (args[0].includes('.wasm')) {
			return _fetchBackup(...args);
		}
		console.log('Getch called');
		const response = await _fetchBackup(...args);
		return new ByobResponse(await response.arrayBuffer(), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};
	// console.log(
	// 	await (await window.fetch('/index.html')).body
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
	// 	if (options && options.mode === 'byob') {
	// 		return streamToByobStream(this).getReader();
	// 	}
	// 	return _getReader.call(this, options);
	// };

	// // ReadableStream.prototype.pipeTo = function pipeTo(target, options) {
	// // 	return streamToByobStream(this).pipeTo(target, options);
	// // };
	// ReadableStream.prototype.pipeThrough = function pipeThrough(
	// 	target,
	// 	options
	// ) {
	// 	return streamToByobStream(this).pipeThrough(target, options);
	// };
}

// Make this file a module
export {};
