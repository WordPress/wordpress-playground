import { FileEntry, readAllBytes } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';

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

async function* iterateZipEntries(zipStream: BufferedReadableStream) {
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
			yield await readCentralDirectory(zipStream);
		} else if (signature === SIGNATURE_CENTRAL_DIRECTORY_END) {
			yield await readEndCentralDirectory(zipStream);
		} else {
			break; // throw new Error(`Unknown signature: ${signature}`);
		}
	}
}

export async function* iterateZipFiles(stream: ReadableStream<Uint8Array>) {
	for await (const entry of iterateZipEntries(
		BufferedReadableStream.fromStream(stream)
	)) {
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

interface CentralDirectoryEntry {
	versionCreated: number;
	versionNeeded: number;
	generalPurpose: number;
	compressionMethod: number;
	lastModifiedTime: number;
	lastModifiedDate: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	fileNameLength: number;
	extraLength: number;
	fileCommentLength: number;
	diskNumber: number;
	internalAttributes: number;
	externalAttributes: number;
	offset: number;
	fileName: string;
	extra: string;
	fileComment: string;
}

async function readCentralDirectory(
	stream: BufferedReadableStream
): Promise<CentralDirectoryEntry> {
	const centralDirectory: Partial<CentralDirectoryEntry> = {
		versionCreated: await stream.readUint16(),
		versionNeeded: await stream.readUint16(),
		generalPurpose: await stream.readUint16(),
		compressionMethod: await stream.readUint16(),
		lastModifiedTime: await stream.readUint16(),
		lastModifiedDate: await stream.readUint16(),
		crc: await stream.readUint32(),
		compressedSize: await stream.readUint32(),
		uncompressedSize: await stream.readUint32(),
		fileNameLength: await stream.readUint16(),
		extraLength: await stream.readUint16(),
		fileCommentLength: await stream.readUint16(),
		diskNumber: await stream.readUint16(),
		internalAttributes: await stream.readUint16(),
		externalAttributes: await stream.readUint32(),
	};
	centralDirectory['offset'] = await stream.readUint32();
	centralDirectory['fileName'] = new TextDecoder().decode(
		await stream.read(centralDirectory.fileNameLength!)
	);
	centralDirectory['extra'] = new TextDecoder().decode(
		await stream.read(centralDirectory.extraLength!)
	);
	centralDirectory['fileComment'] = new TextDecoder().decode(
		await stream.read(centralDirectory.fileCommentLength!)
	);
	return centralDirectory as CentralDirectoryEntry;
}

interface CentralDirectoryEndEntry {
	numberOfDisks: number;
	centralDirectoryStartDisk: number;
	numberCentralDirectoryRecordsOnThisDisk: number;
	numberCentralDirectoryRecords: number;
	centralDirectorySize: number;
	centralDirectoryOffset: number;
	commentLength: number;
	comment: string;
}

async function readEndCentralDirectory(stream: BufferedReadableStream) {
	const endOfDirectory: Partial<CentralDirectoryEndEntry> = {
		numberOfDisks: await stream.readUint16(),
		centralDirectoryStartDisk: await stream.readUint16(),
		numberCentralDirectoryRecordsOnThisDisk: await stream.readUint16(),
		numberCentralDirectoryRecords: await stream.readUint16(),
		centralDirectorySize: await stream.readUint32(),
		centralDirectoryOffset: await stream.readUint32(),
		commentLength: await stream.readUint16(),
	};
	endOfDirectory['comment'] = new TextDecoder().decode(
		await stream.read(endOfDirectory.commentLength!)
	);

	return endOfDirectory as CentralDirectoryEndEntry;
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

	static fromStream(stream: ReadableStream<Uint8Array>) {
		return new BufferedReadableStream(stream.getReader());
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

class ZipScanner {
	constructor(private source: RangeGetter) {}

	async *listFiles(): AsyncGenerator<CentralDirectoryEntry> {
		const endSignaturePos = await this.scanZipFileCentralDirectory();
		if (!endSignaturePos) throw new Error('End signature not found');
		console.log({ endSignaturePos });

		const endSignature = await readEndCentralDirectory(
			BufferedReadableStream.fromStream(
				await this.source.readStream(
					endSignaturePos + 4, // Skip the signature
					this.source.length - 1
				)
			)
		);
		console.log({ endSignature });

		const centralDirectoryStream = BufferedReadableStream.fromStream(
			await this.source.readStream(
				endSignature['centralDirectoryOffset'],
				endSignaturePos - 1
			)
		);

		yield* iterateZipEntries(
			centralDirectoryStream
		) as AsyncGenerator<CentralDirectoryEntry>;
	}

	async readFile(
		record: CentralDirectoryEntry
	): Promise<ZipFileEntry | undefined> {
		const fileStream = BufferedReadableStream.fromStream(
			await this.source.readStream(
				record.offset,
				record.offset + record.compressedSize - 1
			)
		);

		for await (const file of iterateZipEntries(fileStream)) {
			return file as ZipFileEntry;
		}
	}

	private async scanZipFileCentralDirectory() {
		const signature = 0x06054b50;
		const chunkSize = 1024; // Size of each chunk to scan, adjust as needed

		// Scan from the end using Byte Range headers
		for (
			let start = this.source.length - chunkSize;
			start >= 0;
			start -= chunkSize
		) {
			const end = Math.min(start + chunkSize - 1, this.source.length - 1);
			const view = await this.source.read(start, end);

			// Scan the buffer for the signature
			for (let i = 0; i < view.byteLength - 4; i++) {
				if (view.getUint32(i, true) === signature) {
					console.log({ start, i });
					return start + i; // Return the position of the signature
				}
			}
		}

		return null; // Signature not found
	}

	private async findCentralDirectoryStart(
		endSignaturePos: number
	): Promise<number | null> {
		const startSignature = 0x02014b50;
		const chunkSize = 1024; // Adjust as needed

		// Calculate the start position for scanning the central directory start
		let start = Math.max(0, endSignaturePos - chunkSize);

		while (start >= 0) {
			const end = endSignaturePos - 1;
			const view = await this.source.read(start, end);

			// Scan the buffer backwards for the start signature
			for (let i = view.byteLength - 1; i >= 4; i--) {
				if (view.getUint32(i - 4, true) === startSignature) {
					return start + i - 4; // Return the position of the start signature
				}
			}

			// Update the positions for the next iteration
			endSignaturePos = start;
			start = Math.max(0, start - chunkSize);
		}

		return null; // Start signature not found
	}
}

type RangeGetter = {
	length: number;
	read: (start: number, end: number) => Promise<DataView>;
	readStream: (
		start: number,
		end: number
	) => Promise<ReadableStream<Uint8Array>>;
};

async function fetchBytes(url: string): Promise<RangeGetter> {
	const response = await fetch(url, { method: 'HEAD' });
	if (!response.ok) throw new Error('Failed to fetch the ZIP file');

	const contentLength = response.headers.get('Content-Length');
	if (!contentLength) throw new Error('Content-Length header is missing');

	const read = async (from: number, to: number) =>
		await fetch(url, {
			headers: {
				Range: `bytes=${from}-${to}`,
			},
		})
			.then((response) => response.arrayBuffer())
			.then((buffer) => new DataView(buffer));

	const readStream = async (from: number, to: number) =>
		await fetch(url, {
			headers: {
				Range: `bytes=${from}-${to}`,
			},
		}).then((response) => response.body!);

	return {
		read,
		readStream,
		length: parseInt(contentLength, 10),
	};
}

const scanner = new ZipScanner(
	await fetchBytes(
		'https://downloads.wordpress.org/plugin/gutenberg.latest-stable.zip'
		// 'https://wordpress.org/nightly-builds/wordpress-latest.zip'
	)
);

const sem = new Semaphore({ concurrency: 10 });

for await (const cdr of scanner.listFiles()) {
	if (cdr.fileName.startsWith('gutenberg/lib/experimental')) {
		if (cdr.uncompressedSize > 0) {
			sem.acquire().then(async (release) => {
				try {
					const file = await scanner.readFile(cdr);
					console.log(
						{ file }
						// await readAllBytes(file!.dataStream.getReader())
					);
				} finally {
					release();
				}
			});
		}
	}
}

throw new Error();
