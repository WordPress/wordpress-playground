import { collectBytes } from './collect-bytes';

/**
 * Represents a file that is streamed and not fully
 * loaded into memory.
 */
export class StreamedFile extends File {
	/**
	 * Creates a new StreamedFile instance.
	 *
	 * @param readableStream The readable stream containing the file data.
	 * @param name The name of the file.
	 * @param type The MIME type of the file.
	 */
	constructor(
		private readableStream: ReadableStream<Uint8Array>,
		name: string,
		type?: string
	) {
		super([], name, { type });
	}

	/**
	 * Overrides the slice() method of the File class.
	 *
	 * @returns A Blob representing a portion of the file.
	 */
	override slice(): Blob {
		throw new Error('slice() is not possible on a StreamedFile');
	}

	/**
	 * Returns the readable stream associated with the file.
	 *
	 * @returns The readable stream.
	 */
	override stream() {
		return this.readableStream;
	}

	/**
	 * Loads the file data into memory and then returns it as a string.
	 *
	 * @returns File data as text.
	 */
	override async text() {
		return new TextDecoder().decode(await this.arrayBuffer());
	}

	/**
	 * Loads the file data into memory and then returns it as an ArrayBuffer.
	 *
	 * @returns File data as an ArrayBuffer.
	 */
	override async arrayBuffer() {
		return await collectBytes(this.stream());
	}
}
