import { concatUint8Arrays } from './tls/utils';

/**
 * A TransformStream that decodes HTTP chunked transfer encoding.
 * Each chunk starts with the chunk size in hex followed by CRLF,
 * then the chunk data, then CRLF. A chunk size of 0 indicates the end.
 */
export class ChunkedDecoderStream extends TransformStream<
	Uint8Array,
	Uint8Array
> {
	constructor() {
		let buffer = new Uint8Array(0);
		let state:
			| 'SCAN_CHUNK_SIZE'
			| 'SCAN_CHUNK_DATA'
			| 'SCAN_CHUNK_TRAILER'
			| 'SCAN_FINAL_CHUNK' = 'SCAN_CHUNK_SIZE';
		let chunkRemainingBytes = 0;

		super({
			transform(chunk, controller) {
				// Add new chunk to buffer
				buffer = concatUint8Arrays([buffer, chunk]);

				while (buffer.length > 0) {
					if (state === 'SCAN_CHUNK_SIZE') {
						// Need at least "0\r\n" (3 bytes)
						if (buffer.length < 3) {
							return;
						}

						// Find the chunk size hex digits
						let chunkBytesNb = 0;
						while (chunkBytesNb < buffer.length) {
							const byte = buffer[chunkBytesNb];
							const isHexDigit =
								(byte >= 48 && byte <= 57) || // 0-9
								(byte >= 97 && byte <= 102) || // a-f
								(byte >= 65 && byte <= 70); // A-F
							if (!isHexDigit) break;
							chunkBytesNb++;
						}

						if (chunkBytesNb === 0) {
							throw new Error('Invalid chunk size format');
						}

						// Look for CRLF after chunk size
						if (buffer.length < chunkBytesNb + 2) {
							// Not enough data, let's wait for more
							return;
						}
						if (
							buffer[chunkBytesNb] !== 13 || // \r
							buffer[chunkBytesNb + 1] !== 10 // \n
						) {
							throw new Error(
								'Invalid chunk size format. Expected CRLF after chunk size'
							);
						}

						// Parse the chunk size
						const chunkSizeHex = new TextDecoder().decode(
							buffer.slice(0, chunkBytesNb)
						);
						const chunkSize = parseInt(chunkSizeHex, 16);

						// Remove chunk header from buffer
						buffer = buffer.slice(chunkBytesNb + 2);

						if (chunkSize === 0) {
							state = 'SCAN_FINAL_CHUNK';
							controller.terminate();
							return;
						}

						chunkRemainingBytes = chunkSize;
						state = 'SCAN_CHUNK_DATA';
					} else if (state === 'SCAN_CHUNK_DATA') {
						const bytesToRead = Math.min(
							chunkRemainingBytes,
							buffer.length
						);
						const data = buffer.slice(0, bytesToRead);
						buffer = buffer.slice(bytesToRead);
						chunkRemainingBytes -= bytesToRead;

						controller.enqueue(data);

						if (chunkRemainingBytes === 0) {
							state = 'SCAN_CHUNK_TRAILER';
						}
					} else if (state === 'SCAN_CHUNK_TRAILER') {
						if (buffer.length < 2) {
							// Not enough data, let's wait for more
							return;
						}

						if (buffer[0] !== 13 || buffer[1] !== 10) {
							// \r\n
							throw new Error(
								'Invalid chunk trailer format. Expected CRLF after chunk data'
							);
						}

						buffer = buffer.slice(2);
						state = 'SCAN_CHUNK_SIZE';
					}
				}
			},
		});
	}
}
