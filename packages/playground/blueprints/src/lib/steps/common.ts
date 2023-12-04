import type { UniversalPHP } from '@php-wasm/universal';

export function zipNameToHumanName(zipName: string) {
	const mixedCaseName = zipName.split('.').shift()!.replace(/-/g, ' ');
	return (
		mixedCaseName.charAt(0).toUpperCase() +
		mixedCaseName.slice(1).toLowerCase()
	);
}

type PatchFileCallback = (contents: string) => string | Uint8Array;
export async function updateFile(
	php: UniversalPHP,
	path: string,
	callback: PatchFileCallback
) {
	let contents = '';
	if (await php.fileExists(path)) {
		contents = await php.readFileAsText(path);
	}
	await php.writeFile(path, callback(contents));
}

export async function fileToUint8Array(file: File) {
	return new Uint8Array(await file.arrayBuffer());
}

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
 * functions like writeFile (./client-methods.ts) and fileToUint8Array (above).
 */

globalThis.File =
	globalThis.File ||
	class extends Blob {
		_name: string;
		lastModified: number | undefined;
		constructor(
			bits: any,
			name: string,
			options: { type?: string; lastModified?: number } = {}
		) {
			super(bits);
			if (options.lastModified) {
				this.lastModified = options.lastModified;
			}
			if (name) {
				this._name = name;
			} else {
				this._name = '';
			}
		}
		override get name() {
			return this._name;
		}
	};

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
