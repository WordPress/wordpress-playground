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
	extra: Uint8Array;
}

export interface ZipFileEntry extends ZipFileHeader {
	body: ReadableStream<Uint8Array>;
	text(): Promise<string>;
	bytes(): Promise<Uint8Array>;
}

const FILE_HEADER_SIZE = 32;
const SIGNATURE_FILE = 0x04034b50;
const SIGNATURE_CENTRAL_DIRECTORY_START = 0x02014b50;
const SIGNATURE_CENTRAL_DIRECTORY_END = 0x06054b50;

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
	extra: Uint8Array;
	fileComment: string;
}

async function readCentralDirectory(
	stream: ReadableStream<Uint8Array>,
	skipSignature = false
): Promise<CentralDirectoryEntry | null> {
	if (!skipSignature) {
		const signature = await readUint32(stream);
		if (signature !== SIGNATURE_CENTRAL_DIRECTORY_START) {
			return null;
		}
	}
	const data = await pullBytesAsDataView(stream, 42);
	const centralDirectory: Partial<CentralDirectoryEntry> = {
		versionCreated: data.getUint16(0, true),
		versionNeeded: data.getUint16(2, true),
		generalPurpose: data.getUint16(4, true),
		compressionMethod: data.getUint16(6, true),
		lastModifiedTime: data.getUint16(8, true),
		lastModifiedDate: data.getUint16(10, true),
		crc: data.getUint32(12, true),
		compressedSize: data.getUint32(16, true),
		uncompressedSize: data.getUint32(20, true),
		fileNameLength: data.getUint16(24, true),
		extraLength: data.getUint16(26, true),
		fileCommentLength: data.getUint16(28, true),
		diskNumber: data.getUint16(30, true),
		internalAttributes: data.getUint16(32, true),
		externalAttributes: data.getUint32(34, true),
		offset: data.getUint32(38, true),
	};
	centralDirectory['fileName'] = await pullBytes(
		stream,
		centralDirectory.fileNameLength!
	)
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
	centralDirectory['extra'] = await pullBytes(
		stream,
		centralDirectory.extraLength!
	)
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
	centralDirectory['fileComment'] = await pullBytes(
		stream,
		centralDirectory.fileCommentLength!
	)
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
	return centralDirectory as CentralDirectoryEntry;
}

async function readFileHeader(
	stream: ReadableStream<Uint8Array>,
	skipSignature = false
): Promise<ZipFileHeader | null> {
	if (!skipSignature) {
		const signature = await readUint32(stream);
		if (signature !== SIGNATURE_FILE) {
			return null;
		}
	}
	const data = await pullBytesAsDataView(stream, 26);
	const entry: Partial<ZipFileEntry> = {};
	entry['version'] = data.getUint32(0, true);
	entry['generalPurpose'] = data.getUint16(2, true);
	entry['compressionMethod'] = data.getUint16(4, true);
	entry['lastModifiedTime'] = data.getUint16(6, true);
	entry['lastModifiedDate'] = data.getUint16(8, true);
	entry['crc'] = data.getUint32(10, true);
	entry['compressedSize'] = data.getUint32(14, true);
	entry['uncompressedSize'] = data.getUint32(18, true);
	entry['fileNameLength'] = data.getUint16(22, true);
	entry['extraLength'] = data.getUint16(24, true);
	entry['fileName'] = await pullBytes(stream, entry['fileNameLength'])
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
	entry['extra'] = await pullBytes(stream, entry['extraLength'])
		.pipeThrough(concatBytes(entry['extraLength']))
		.getReader()
		.read()
		.then(({ value }) => value);
	console.log({ entry });
	return entry as ZipFileHeader;
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

async function findCentralDirectoryOffset(source: RangeGetter) {
	const chunkSize = 1024; // Size of each chunk to scan, adjust as needed

	// Scan from the end using Byte Range headers
	let previousChunk: DataView | null = null;
	for (
		let start = source.length - chunkSize;
		start >= 0;
		start -= chunkSize
	) {
		const end = Math.min(start + chunkSize - 1, source.length - 1);
		const view = await source.read(start, end);

		// Scan the buffer for the signature
		for (let i = 0; i < view.byteLength - 4; i++) {
			if (view.getUint32(i, true) === SIGNATURE_CENTRAL_DIRECTORY_END) {
				let bothChunks: Uint8Array;
				if (previousChunk) {
					bothChunks = new Uint8Array(
						previousChunk!.buffer.byteLength + view.byteLength
					);
					bothChunks.set(new Uint8Array(view.buffer));
					bothChunks.set(
						new Uint8Array(previousChunk!.buffer),
						view!.byteLength
					);
				} else {
					bothChunks = new Uint8Array(view.buffer);
				}

				const centralDirectorySizeAt = i + 4 + 2 + 2 + 2 + 2;
				const centralDirectoryOffsetAt = centralDirectorySizeAt + 4;
				if (bothChunks.byteLength < centralDirectoryOffsetAt + 4) {
					throw new Error('Central directory not found');
				}
				return {
					offset: view.getUint32(centralDirectoryOffsetAt, true),
					size: view.getUint32(centralDirectorySizeAt, true),
				};
			}
		}
		previousChunk = view;
	}

	throw new Error('Central directory not found');
}

async function readEndCentralDirectory(stream: ReadableStream<Uint8Array>) {
	const endOfDirectory: Partial<CentralDirectoryEndEntry> = {
		numberOfDisks: await readUint16(stream),
		centralDirectoryStartDisk: await readUint16(stream),
		numberCentralDirectoryRecordsOnThisDisk: await readUint16(stream),
		numberCentralDirectoryRecords: await readUint16(stream),
		centralDirectorySize: await readUint32(stream),
		centralDirectoryOffset: await readUint32(stream),
		commentLength: await readUint16(stream),
	};
	endOfDirectory['comment'] = await pullBytes(
		stream,
		endOfDirectory.commentLength!
	)
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
	return endOfDirectory as CentralDirectoryEndEntry;
}

function createFileDataStream(
	stream: ReadableStream<Uint8Array>,
	header: ZipFileHeader
): ReadableStream<Uint8Array> {
	if (header.compressedSize === 0) {
		return new ReadableStream({
			start(controller) {
				controller.close();
			},
		});
	}

	const bytesStream = pullBytes(stream, header.compressedSize);
	if (header.compressionMethod === 0) {
		return bytesStream;
	}
	return bytesStream.pipeThrough(new DecompressionStream('deflate-raw'));
}

function ignore() {
	return new WritableStream({
		write() {},
	});
}

function concatString() {
	const chunks: string[] = [];
	return new TransformStream({
		transform(chunk) {
			console.log('chunk', chunk);
			chunks.push(chunk);
		},

		flush(controller) {
			controller.enqueue(chunks.join(''));
		},
	});
}

function concatBytes(totalBytes?: number) {
	const buffer = new ArrayBuffer(totalBytes || 0);
	let offset = 0;
	return new TransformStream({
		transform(chunk) {
			const view = new Uint8Array(buffer);
			view.set(chunk, offset);
			offset += chunk.length;
		},

		flush(controller) {
			console.log('flush', buffer);
			controller.enqueue(new Uint8Array(buffer));
		},
	});
}
export function concatBytesStream() {
	const chunks: Uint8Array[] = [];
	let size = 0;
	return new TransformStream({
		transform(chunk) {
			chunks.push(chunk);
			size += chunk.length;
		},

		flush(controller) {
			const result = new Uint8Array(size);
			let offset = 0;
			for (const chunk of chunks) {
				result.set(chunk, offset);
				offset += chunk.length;
			}
			controller.enqueue(new Uint8Array(result));
		},
	});
}

export function iterateZipFiles() {}
function listZipFiles(source: RangeGetter) {
	let centralDirectoryStream: ReadableStream<Uint8Array>;

	return new ReadableStream<CentralDirectoryEntry>({
		async pull(controller) {
			if (!centralDirectoryStream) {
				const { size, offset } = await findCentralDirectoryOffset(
					source
				);
				centralDirectoryStream = await source.readStream(
					offset,
					offset + size
				);
			}

			const entry = await readCentralDirectory(centralDirectoryStream);
			if (!entry) {
				controller.close();
				return;
			}
			controller.enqueue(entry);
		},
	});
}

// Asynchronous iteration is not yet implemented in any browser.
// A workaround to use asynchronous iteration today is to implement the behavior with a polyfill.
// @ts-ignore
if (!ReadableStream.prototype[Symbol.asyncIterator]) {
	// @ts-ignore
	ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
		const reader = this.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					return;
				}
				yield value;
			}
		} finally {
			reader.releaseLock();
		}
	};
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
				'Accept-Encoding': 'none',
			},
		})
			.then((response) => response.arrayBuffer())
			.then((buffer) => new DataView(buffer));

	const readStream = async (from: number, to: number) =>
		await fetch(url, {
			headers: {
				Range: `bytes=${from}-${to}`,
				'Accept-Encoding': 'none',
			},
		}).then((response) => response.body!);

	return {
		read,
		readStream,
		length: parseInt(contentLength, 10),
	};
}

async function readUint32(stream: ReadableStream<Uint8Array>) {
	return (await pullBytesAsDataView(stream, 4)).getUint32(0, true);
}

async function readUint16(stream: ReadableStream<Uint8Array>) {
	return (await pullBytesAsDataView(stream, 2)).getUint16(0, true);
}

async function pullBytesAsDataView(
	stream: ReadableStream<Uint8Array>,
	bytes: number
) {
	return await pullBytes(stream, bytes)
		.getReader()
		.read()
		.then(({ value }) => new DataView(value.buffer));
}

function pullBytes(stream: ReadableStream<Uint8Array>, bytes: number) {
	if (bytes === 0) {
		return new ReadableStream({
			start(controller) {
				controller.close();
			},
		});
	}
	// const buffer = new ArrayBuffer(bytes);
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

function filterStream<T>(filter: (chunk: T) => boolean) {
	return new TransformStream<T, T>({
		transform(chunk, controller) {
			if (filter(chunk)) {
				controller.enqueue(chunk);
			}
		},
	});
}

function mapStream<T, R>(map: (chunk: T) => R) {
	return new TransformStream<T, R>({
		async transform(chunk, controller) {
			controller.enqueue(await map(chunk));
		},
	});
}

function chunkZipEntries({ maxGap = 10 * 1024 } = {}) {
	let lastFileEndsAt = 0;
	let currentChunk: CentralDirectoryEntry[] = [];
	return new TransformStream<CentralDirectoryEntry, CentralDirectoryEntry[]>({
		transform(zipEntry, controller) {
			const fileStartsAt = zipEntry.offset!;
			const fileEndsAt =
				zipEntry.offset +
				FILE_HEADER_SIZE +
				zipEntry.fileNameLength +
				zipEntry.fileCommentLength +
				zipEntry.extraLength +
				zipEntry.compressedSize -
				1;
			if (fileStartsAt > lastFileEndsAt + maxGap) {
				controller.enqueue(currentChunk);
				currentChunk = [];
			}
			lastFileEndsAt = fileEndsAt;
			currentChunk.push(zipEntry);
		},
		flush(controller) {
			controller.enqueue(currentChunk);
		},
	});
}

function fetchChunkedEntries(source: RangeGetter) {
	return mapStream((chunk: CentralDirectoryEntry[]) =>
		doFetchChunkedEntries(source, chunk)
	);
}

const sem = new Semaphore({ concurrency: 10 });
async function* doFetchChunkedEntries(
	source: RangeGetter,
	zipEntries: CentralDirectoryEntry[]
) {
	const release = await sem.acquire();
	try {
		const lastZipEntry = zipEntries[zipEntries.length - 1];
		const fileStream = await source.readStream(
			zipEntries[0].offset!,
			lastZipEntry.offset! +
				FILE_HEADER_SIZE +
				lastZipEntry.fileNameLength +
				lastZipEntry.extraLength +
				lastZipEntry.fileCommentLength +
				lastZipEntry.compressedSize -
				1
		);

		while (true) {
			const header = await readFileHeader(fileStream, false);
			if (!header) {
				break;
			}
			const body = await createFileDataStream(fileStream, header);

			const isOneOfRequestedFiles = zipEntries.find(
				(entry) => entry.fileName === header.fileName
			);
			if (isOneOfRequestedFiles) {
				const file = {
					...header,
					body,
				} as ZipFileEntry;
				yield file;
			}
			// Make sure we consume the body stream or else
			// we'll start reading the next file at the wrong
			// offset.
			if (!body.locked) {
				await body.pipeTo(ignore());
			}
		}
	} finally {
		release();
	}
}

const source = await fetchBytes(
	'https://downloads.wordpress.org/plugin/classic-editor.latest-stable.zip'
	// 'https://github.com/Automattic/themes/archive/refs/heads/trunk.zip'
	// 'https://downloads.wordpress.org/plugin/gutenberg.latest-stable.zip'
	// 'https://wordpress.org/nightly-builds/wordpress-latest.zip'
);

function readChunkedEntries() {
	return new TransformStream<AsyncGenerator<ZipFileEntry>, ZipFileEntry>({
		async transform(entries, controller) {
			for await (const entry of entries) {
				const data = await entry.body
					.pipeThrough(concatBytesStream())
					.getReader()
					.read()
					.then(({ value }) => value);
				controller.enqueue({
					...entry,
					data,
				});
			}
		},
	});
}

if (!ReadableStream.prototype[Symbol.asyncIterator]) {
	ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
		const reader = this.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					return;
				}
				yield value;
			}
		} finally {
			reader.releaseLock();
		}
	};
}

const entries = listZipFiles(source)
	.pipeThrough(
		filterStream(
			({ fileName, uncompressedSize }) =>
				!fileName.endsWith('/') || uncompressedSize !== 0
		)
	)
	.pipeThrough(chunkZipEntries())
	.pipeThrough(fetchChunkedEntries(source))
	.pipeThrough(readChunkedEntries());

for await (const entry of entries) {
	console.log(entry);
	console.log(new TextDecoder().decode(entry.data));
}

throw new Error('Expected halt');

/*

const source = await fetchBytes(
	'https://downloads.wordpress.org/plugin/classic-editor.latest-stable.zip'
);

const stream = await source.readStream(0, 25000);
async function __readEntry() {
	console.log((await readUint32(stream)) === SIGNATURE_FILE);
	const header = await readFileHeader(stream);
	console.log(header);
	if (header.compressedSize > 0) {
		const { value } = await pullBytes(stream, header.compressedSize)
			.pipeThrough(new DecompressionStream('deflate-raw'))
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(concatString())
			.getReader()
			.read();
		console.log({ value });
	}
}

await __readEntry();
await __readEntry();

throw new Error('Expected halt');
*/

// const file = await readFileHeader(
// 	await this.source.readStream(
// 		dirEntry.offset,
// 		dirEntry.compressedSize
// 	)
// );
