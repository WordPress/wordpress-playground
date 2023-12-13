export function concatString() {
	const chunks: string[] = [];
	return new TransformStream<string, string>({
		transform(chunk) {
			chunks.push(chunk);
		},

		flush(controller) {
			controller.enqueue(chunks.join(''));
		},
	});
}

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
				offset += chunk.length;
			},

			flush(controller) {
				controller.enqueue(new Uint8Array(buffer));
			},
		});
	}
}

export async function collectString(
	stream: ReadableStream<Uint8Array>,
	bytes: number
) {
	return await limitBytes(stream, bytes)
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
}

export async function collectBytes(
	stream: ReadableStream<Uint8Array>,
	bytes?: number
) {
	if (bytes !== undefined) {
		stream = limitBytes(stream, bytes);
	}

	return await stream
		.pipeThrough(concatBytes(bytes))
		.getReader()
		.read()
		.then(({ value }) => value);
}

export function limitBytes(stream: ReadableStream<Uint8Array>, bytes: number) {
	if (bytes === 0) {
		return new ReadableStream({
			start(controller) {
				controller.close();
			},
		});
	}
	const reader = stream.getReader({ mode: 'byob' });
	let offset = 0;
	return new ReadableStream({
		async pull(controller) {
			const { value, done } = await reader.read(
				new Uint8Array(bytes - offset)
			);
			if (done) {
				reader.releaseLock();
				controller.close();
				return;
			}
			offset += value.length;
			controller.enqueue(value);

			if (offset >= bytes) {
				reader.releaseLock();
				controller.close();
			}
		},
		cancel() {
			reader.cancel();
		},
	});
}

export function concatUint8Array(...arrays: Uint8Array[]) {
	const result = new Uint8Array(
		arrays.reduce((sum, array) => sum + array.length, 0)
	);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}
	return result;
}

export function filterStream<T>(filter: (chunk: T) => boolean) {
	return new TransformStream<T, T>({
		transform(chunk, controller) {
			if (filter(chunk)) {
				controller.enqueue(chunk);
			}
		},
	});
}
