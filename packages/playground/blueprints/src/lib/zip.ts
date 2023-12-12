import { Semaphore } from '@php-wasm/util';

const CENTRAL_DIRECTORY_END_SCAN_CHUNK_SIZE = 50 * 1024;

const FILE_HEADER_SIZE = 32;
const SIGNATURE_FILE = 0x04034b50;
const SIGNATURE_CENTRAL_DIRECTORY_START = 0x02014b50;
const SIGNATURE_CENTRAL_DIRECTORY_END = 0x06054b50;

export interface FileEntry {
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
	isDirectory: boolean;
	extraLength: number;
	extra: Uint8Array;
	text(): Promise<string>;
	bytes(): Promise<Uint8Array>;
}

async function readFileEntry(
	stream: ReadableStream<Uint8Array>,
	skipSignature = false
): Promise<FileEntry | null> {
	if (!skipSignature) {
		const signature = await readUint32(stream);
		if (signature !== SIGNATURE_FILE) {
			return null;
		}
	}
	const data = await pullBytesAsDataView(stream, 26);
	const entry: Partial<FileEntry> = {};
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
	entry['isDirectory'] = entry.fileName!.endsWith('/');
	entry['extra'] = await pullBytes(stream, entry['extraLength'])
		.pipeThrough(concatBytes(entry['extraLength']))
		.getReader()
		.read()
		.then(({ value }) => value);

	// Make sure we consume the body stream or else
	// we'll start reading the next file at the wrong
	// offset.
	// @TODO: Expose the body stream instead of reading it all
	//        eagerly. Ensure the next iteration exhausts
	//        the last body stream before moving on.
	const body = await createFileDataStream(
		stream,
		entry['compressedSize'],
		entry['compressionMethod']
	)
		.pipeThrough(concatBytesStream())
		.getReader()
		.read()
		.then(({ value }) => value!);
	entry['bytes'] = () => Promise.resolve(body);
	entry['text'] = () => Promise.resolve(new TextDecoder().decode(body));
	return entry as FileEntry;
}

function createFileDataStream(
	stream: ReadableStream<Uint8Array>,
	compressedSize: number,
	compressionMethod: number
): ReadableStream<Uint8Array> {
	if (compressedSize === 0) {
		return new ReadableStream({
			start(controller) {
				controller.close();
			},
		});
	}

	const bytesStream = pullBytes(stream, compressedSize);
	if (compressionMethod === 0) {
		return bytesStream;
	}
	return bytesStream.pipeThrough(new DecompressionStream('deflate-raw'));
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
	firstByteAt: number;
	lastByteAt: number;
	fileName: string;
	extra: Uint8Array;
	fileComment: string;
	isDirectory: boolean;
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
		firstByteAt: data.getUint32(38, true),
	};
	centralDirectory['lastByteAt'] =
		centralDirectory.firstByteAt! +
		FILE_HEADER_SIZE +
		centralDirectory.fileNameLength! +
		centralDirectory.fileCommentLength! +
		centralDirectory.extraLength! +
		centralDirectory.compressedSize! -
		1;

	centralDirectory['fileName'] = await pullBytes(
		stream,
		centralDirectory.fileNameLength!
	)
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
	centralDirectory['isDirectory'] = centralDirectory.fileName!.endsWith('/');
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
	return new TransformStream<Uint8Array, Uint8Array>({
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
		async start() {
			centralDirectoryStream = await findCentralDirectory(source);
		},
		async pull(controller) {
			try {
				const entry = await readCentralDirectory(
					centralDirectoryStream
				);
				console.log({ entry });
				if (!entry) {
					controller.close();
					return;
				}
				controller.enqueue(entry);
			} catch (e) {
				console.error(e);
				controller.error(e);
				throw e;
			}
		},
	});
}

async function findCentralDirectory(source: RangeGetter) {
	const chunkSize = CENTRAL_DIRECTORY_END_SCAN_CHUNK_SIZE;
	let centralDirectory: Uint8Array = new Uint8Array();

	let chunkStart = source.length;
	do {
		chunkStart = Math.max(0, chunkStart - chunkSize);
		const chunkEnd = Math.min(
			chunkStart + chunkSize - 1,
			source.length - 1
		);
		const view = await source.read(chunkStart, chunkEnd);

		const bytes = new Uint8Array(view.buffer);
		centralDirectory = concatUint8Array(bytes, centralDirectory);

		// Scan the buffer for the signature
		for (let i = 0; i < view.byteLength - 4; i++) {
			if (view.getUint32(i, true) === SIGNATURE_CENTRAL_DIRECTORY_END) {
				const centralDirectoryLengthAt = i + 4 + 2 + 2 + 2 + 2;
				const centralDirectoryOffsetAt = centralDirectoryLengthAt + 4;
				if (
					centralDirectory.byteLength <
					centralDirectoryOffsetAt + 4
				) {
					throw new Error('Central directory not found');
				}

				const dirStart = view.getUint32(centralDirectoryOffsetAt, true);
				if (dirStart < chunkStart) {
					// We're missing some bytes, let's grab them
					const missingBytes = await source
						.read(dirStart, chunkStart - 1)
						.then((view) => new Uint8Array(view.buffer));
					centralDirectory = concatUint8Array(
						missingBytes,
						centralDirectory
					);
				} else if (dirStart > chunkStart) {
					// We've read too many bytes, let's trim them
					centralDirectory = centralDirectory.slice(
						dirStart - chunkStart
					);
				}
				return new Blob([centralDirectory]).stream();
			}
		}
	} while (chunkStart >= 0);

	throw new Error('Central directory not found');
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

function partitionNearbyEntries({ maxGap = -10 * 1024 } = {}) {
	let lastFileEndsAt = 0;
	let currentChunk: CentralDirectoryEntry[] = [];
	return new TransformStream<CentralDirectoryEntry, CentralDirectoryEntry[]>({
		transform(zipEntry, controller) {
			// Byte distance too large, flush and start a new chunk
			if (zipEntry.firstByteAt > lastFileEndsAt + maxGap) {
				controller.enqueue(currentChunk);
				currentChunk = [];
			}
			lastFileEndsAt = zipEntry.lastByteAt;
			currentChunk.push(zipEntry);
		},
		flush(controller) {
			controller.enqueue(currentChunk);
		},
	});
}

function fetchPartitionedEntries(
	source: RangeGetter
): ReadableWritablePair<FileEntry, CentralDirectoryEntry[]> {
	let isWritableClosed = false;
	let requestsInProgress = 0;
	let readableController: ReadableStreamDefaultController<FileEntry>;
	const byteStreams: ReadableStream<Uint8Array>[] = [];
	const readable = new ReadableStream<FileEntry>({
		start(controller) {
			readableController = controller;
		},
		async pull(controller) {
			while (true) {
				if (
					isWritableClosed &&
					!byteStreams.length &&
					requestsInProgress === 0
				) {
					controller.close();
					return;
				}

				if (!byteStreams.length) {
					await new Promise((resolve) => setTimeout(resolve, 50));
					continue;
				}

				const stream = byteStreams[0];
				const file = await readFileEntry(stream);
				if (!file) {
					byteStreams.shift();
					continue;
				}

				controller.enqueue(file);
				break;
			}
		},
	});
	const writable = new WritableStream<CentralDirectoryEntry[]>({
		write(zipEntries, controller) {
			if (!zipEntries.length) {
				return;
			}
			++requestsInProgress;
			// If the write() method returns a promise, the next
			// call will be delayed until the promise resolves.
			// Let's not return the promise, then.
			// This will effectively issue many requests in parallel.
			requestChunkRange(source, zipEntries)
				.then((byteStream) => {
					byteStreams.push(byteStream);
				})
				.catch((e) => {
					controller.error(e);
				})
				.finally(() => {
					--requestsInProgress;
				});
		},
		abort() {
			isWritableClosed = true;
			readableController.close();
		},
		async close() {
			isWritableClosed = true;
		},
	});

	return {
		readable,
		writable,
	};
}

const sem = new Semaphore({ concurrency: 10 });
async function requestChunkRange(
	source: RangeGetter,
	zipEntries: CentralDirectoryEntry[]
) {
	const release = await sem.acquire();
	try {
		const lastZipEntry = zipEntries[zipEntries.length - 1];
		const substream = await source.readStream(
			zipEntries[0].firstByteAt,
			lastZipEntry.lastByteAt
		);
		return substream;
	} catch (e) {
		console.error(e);
		throw e;
	} finally {
		release();
	}
}

function concatUint8Array(...arrays: Uint8Array[]) {
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

const source = await fetchBytes(
	'https://downloads.wordpress.org/plugin/classic-editor.latest-stable.zip'
	// 'https://github.com/Automattic/themes/archive/refs/heads/trunk.zip'
	// 'https://downloads.wordpress.org/plugin/gutenberg.latest-stable.zip'
	// 'https://wordpress.org/nightly-builds/wordpress-latest.zip'
);
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

type IterableReadableStream<R> = ReadableStream<R> & {
	[Symbol.asyncIterator](): AsyncIterableIterator<R>;
};

const zipEntries = listZipFiles(source)
	.pipeThrough(
		filterStream(
			({ fileName, uncompressedSize }) =>
				!fileName.endsWith('/') || uncompressedSize !== 0
		)
	)
	.pipeThrough(partitionNearbyEntries())
	.pipeThrough(
		fetchPartitionedEntries(source)
	) as IterableReadableStream<FileEntry>;

for await (const chunk of zipEntries) {
	console.log({ chunk });
	console.log(await chunk.text());
}

throw new Error('Expected halt');
