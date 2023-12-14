import { concatUint8Array } from './concat-uint8-array';

export function concatBytes(totalBytes?: number) {
	if (totalBytes === undefined) {
		let acc = new Uint8Array();
		return new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk) {
				acc = concatUint8Array(acc, chunk);
			},

			flush(controller) {
				controller.enqueue(acc);
			},
		});
	} else {
		const buffer = new ArrayBuffer(totalBytes || 0);
		let offset = 0;
		return new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk) {
				const view = new Uint8Array(buffer);
				view.set(chunk, offset);
				offset += chunk.byteLength;
			},

			flush(controller) {
				controller.enqueue(new Uint8Array(buffer));
			},
		});
	}
}
