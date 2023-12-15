/**
 * Polyfill the File class in JSDOM which lacks arrayBuffer() method
 *
 * - [Implement Blob.stream, Blob.text and Blob.arrayBuffer](https://github.com/jsdom/jsdom/issues/2555)
 *
 * When a Resource (../resources.ts) resolves to an instance of File, the
 * resulting object is missing the arrayBuffer() method in JSDOM environment
 * during tests.
 *
 * Import the polyfilled File class below to ensure its buffer is available to
 * functions like writeFile (./client-methods.ts).
 */
class FilePolyfill extends File {
	buffers: BlobPart[];
	constructor(buffers: BlobPart[], name: string) {
		super(buffers, name);
		this.buffers = buffers;
	}
	override async arrayBuffer(): Promise<ArrayBuffer> {
		return this.buffers[0] as ArrayBuffer;
	}
}

const FileWithArrayBuffer =
	File.prototype.arrayBuffer instanceof Function ? File : FilePolyfill;

export { FileWithArrayBuffer as File };
