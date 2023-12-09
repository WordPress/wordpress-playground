import { FileEntry, readAllBytes } from '@php-wasm/universal';

export interface ZipFileHeader {
	startsAt?: number;
	extract?: any;
	signature: string;
	version: number;
	generalPurpose: number;
	compressionMethod: number;
	lastModifiedTime: number;
	lastModifiedDate: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	fileNameLength: number;
	fileName: string;
	extraLength: number;
	extra: string;
}

export interface ZipFileEntry extends ZipFileHeader {
	dataStream: ReadableStream<Uint8Array>;
}

const SIGNATURE_FILE = 0x04034b50;
const SIGNATURE_CENTRAL_DIRECTORY_START = 0x02014b50;
const SIGNATURE_CENTRAL_DIRECTORY_END = 0x06054b50;

async function* iterateZipEntries(stream: ReadableStream<Uint8Array>) {
	const zipStream = new BufferedReadableStream(stream.getReader());
	while (true) {
		const signature = await zipStream.readUint32();
		// console.log({ signature });
		if (signature === SIGNATURE_FILE) {
			const header = await readFileHeader(zipStream);
			const fileDataStream = await createFileDataStream(
				zipStream,
				header
			);
			yield {
				...header,
				dataStream: fileDataStream,
			} as ZipFileEntry;
		} else if (signature === SIGNATURE_CENTRAL_DIRECTORY_START) {
			break;
		} else if (signature === SIGNATURE_CENTRAL_DIRECTORY_END) {
			break;
		} else {
			throw new Error(`Unknown signature: ${signature}`);
		}
	}
}

export async function* iterateZipFiles(stream: ReadableStream<Uint8Array>) {
	for await (const entry of iterateZipEntries(stream)) {
		yield toZipFile(entry);
	}
}

function toZipFile(entry: ZipFileEntry): FileEntry {
	return {
		path: entry.fileName,
		isDirectory: entry.fileName.endsWith('/'),
		async read() {
			return await readAllBytes(entry.dataStream.getReader());
		},
	};
}

async function readFileHeader(
	stream: BufferedReadableStream
): Promise<ZipFileHeader> {
	const entry: Partial<ZipFileEntry> = {};
	entry['version'] = await stream.readUint16();
	entry['generalPurpose'] = await stream.readUint16();
	entry['compressionMethod'] = await stream.readUint16();
	entry['lastModifiedTime'] = await stream.readUint16();
	entry['lastModifiedDate'] = await stream.readUint16();
	entry['crc'] = await stream.readUint32();
	entry['compressedSize'] = await stream.readUint32();
	entry['uncompressedSize'] = await stream.readUint32();
	entry['fileNameLength'] = await stream.readUint16();
	entry['extraLength'] = await stream.readUint16();
	entry['fileName'] = new TextDecoder().decode(
		await stream.read(entry.fileNameLength)
	);
	entry['extra'] = new TextDecoder().decode(
		await stream.read(entry['extraLength'])
	);
	return entry as ZipFileHeader;
}

async function createFileDataStream(
	stream: BufferedReadableStream,
	header: ZipFileHeader
): Promise<ReadableStream<Uint8Array>> {
	if (header.compressedSize === 0) {
		return new ReadableStream({
			start(controller) {
				controller.close();
			},
		});
	}

	const data = await stream.read(header.compressedSize);
	const subStream = new ReadableStream({
		start(controller) {
			controller.enqueue(data);
			controller.close();
		},
	});

	if (header.compressionMethod === 0) {
		return subStream;
	}

	return subStream.pipeThrough(new DecompressionStream('deflate-raw'));
}

class BufferedReadableStream {
	reader: ReadableStreamDefaultReader<Uint8Array>;
	buffer: Uint8Array;

	constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
		this.reader = reader;
		this.buffer = new Uint8Array();
	}

	async read(n: number) {
		if (this.buffer.length >= n) {
			const result = this.buffer.slice(0, n);
			this.buffer = this.buffer.slice(n);
			return new DataView(result.buffer);
		}

		const result = new Uint8Array(n);
		result.set(this.buffer);

		let bufferedBytes = this.buffer.length;
		while (bufferedBytes < n) {
			const { done, value } = await this.reader.read();
			if (done) {
				this.buffer = new Uint8Array();
				break;
			}
			const fitBytes = Math.min(value.length, n - bufferedBytes);
			result.set(value.slice(0, fitBytes), bufferedBytes);
			bufferedBytes += value.length;
			if (fitBytes < value.length) {
				this.buffer = value.slice(fitBytes);
				break;
			}
		}
		return new DataView(result.buffer);
	}

	async readUint16() {
		const result = await this.read(2);
		return result.getUint16(0, true);
	}

	async readUint32() {
		const result = await this.read(4);
		return result.getUint32(0, true);
	}

	releaseLock() {
		this.reader.releaseLock();
	}
}
