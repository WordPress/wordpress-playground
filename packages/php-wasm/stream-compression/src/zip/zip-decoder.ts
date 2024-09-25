import { concatUint8Array } from '../utils/concat-uint8-array';
import {
	CentralDirectoryEntry,
	COMPRESSION_DEFLATE,
	CompressionMethod,
	FILE_HEADER_SIZE,
	FileEntry,
	SIGNATURE_CENTRAL_DIRECTORY,
	SIGNATURE_CENTRAL_DIRECTORY_END,
	SIGNATURE_FILE,
} from './types';

interface AbstractStreamView {
	length: number;
	slice: (start: number, end?: number) => Promise<ConvenientStreamWrapper>;
}

class FetchStreamView implements AbstractStreamView {
	static async create(url: string, length?: number) {
		if (length === undefined) {
			length = await fetchContentLength(url);
		}

		return new FetchStreamView(url, length);
	}

	constructor(private url: string, private contentLength: number) {}

	async slice(start: number, end?: number) {
		end = end ?? this.contentLength;
		const stream = await fetch(this.url, {
			headers: {
				// The Range header is inclusive, so we need to subtract 1
				Range: `bytes=${start}-${end - 1}`,
				'Accept-Encoding': 'none',
			},
		}).then((response) => response.body!);
		return new ConvenientStreamWrapper(stream, end - start);
	}
}

export class TeeStreamView implements AbstractStreamView {
	constructor(
		protected stream: ReadableStream<Uint8Array>,
		public length: number
	) {}

	static fromResponse(response: Response, length?: number) {
		return new TeeStreamView(
			response.body!,
			length ?? Number(response.headers.get('content-length'))
		);
	}

	async slice(start: number, end?: number) {
		end = end ?? this.length;
		const [left, right] = this.stream.tee();
		this.stream = left;
		const s = new ConvenientStreamWrapper(right, end);
		await s.skip(start);
		return s;
	}
}

/**
 * Fetches the Content-Length header from a remote URL.
 */
async function fetchContentLength(url: string) {
	return await fetch(url, { method: 'HEAD' })
		.then((response) => response.headers.get('Content-Length'))
		.then((contentLength) => {
			if (!contentLength) {
				throw new Error('Content-Length header is missing');
			}

			const parsedLength = parseInt(contentLength, 10);
			if (isNaN(parsedLength) || parsedLength < 0) {
				throw new Error('Content-Length header is invalid');
			}
			return parsedLength;
		});
}

export class ConvenientStreamWrapper {
	static fromBytes(bytes: Uint8Array) {
		return new ConvenientStreamWrapper(
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(bytes);
					controller.close();
				},
			}),
			bytes.length
		);
	}

	static chain(...streams: ConvenientStreamWrapper[]) {
		const remainingStreams = streams.map((stream) =>
			stream.streamRemainingBytes()
		);
		let currentReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
		const totalLength = streams.reduce(
			(acc, stream) => acc + stream.length!,
			0
		);
		return new ConvenientStreamWrapper(
			new ReadableStream<Uint8Array>({
				start() {
					currentReader = remainingStreams.shift()!.getReader();
				},
				async pull(controller) {
					while (currentReader) {
						const result = await currentReader.read();
						if (result?.done) {
							if (remainingStreams.length) {
								currentReader = remainingStreams
									.shift()!
									.getReader();
								continue;
							}
							currentReader = undefined;
							controller.close();
							return;
						}
						controller.enqueue(result.value);
					}
				},
			}),
			totalLength
		);
	}

	private reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	private buffer: Uint8Array;
	private readBytes = 0;
	private stream: ReadableStream<Uint8Array>;
	public length?: number;

	constructor(stream: ReadableStream<Uint8Array>, length: number) {
		this.buffer = new Uint8Array();
		this.stream = stream;
		this.length = length;
	}

	async addTransform(
		transform: ReadableWritablePair<Uint8Array, Uint8Array>
	) {
		if (this.reader) {
			this.reader.releaseLock();
			this.reader = undefined;
		}
		this.stream = this.stream.pipeThrough(transform);
	}

	async skip(skipBytes: number) {
		let skipped = 0;
		while (skipped < skipBytes) {
			const bytesToSkip = Math.min(skipBytes - skipped, 8096);
			await this.read(bytesToSkip);
			skipped += bytesToSkip;
		}
		this.readBytes -= skipped;
	}

	async read(bytes = 8096) {
		if (this.buffer.byteLength >= bytes) {
			const result = this.buffer.slice(0, bytes);
			this.buffer = this.buffer.slice(bytes);
			return result;
		}

		if (!this.reader) {
			this.reader = this.stream.getReader();
		}

		let bytesRead = 0;
		while (this.buffer.byteLength < bytes) {
			const result = await this.reader.read();
			if (!result?.value) {
				break;
			}
			bytesRead += result.value.byteLength;
			this.buffer = concatUint8Array(this.buffer, result.value);
		}

		this.readBytes += bytesRead;
		if (
			this.length &&
			this.readBytes + this.buffer.byteLength > this.length
		) {
			const newBufferByteLength =
				this.length! - (this.readBytes - this.buffer.byteLength);
			this.buffer = this.buffer.slice(0, newBufferByteLength);
		}

		const result = this.buffer.slice(0, bytes);
		this.buffer = this.buffer.slice(bytes);
		return result;
	}

	streamRemainingBytes(): ReadableStream<Uint8Array> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		return new ReadableStream({
			async start(controller) {
				controller.enqueue(await self.read());
			},
			async pull(controller) {
				const chunk = await self.read();
				if (chunk.byteLength === 0) {
					controller.close();
					return;
				}
				controller.enqueue(chunk);
			},
		});
	}
}

const CENTRAL_DIRECTORY_END_SCAN_CHUNK_SIZE = 110 * 1024;

export class ZipDecoder {
	constructor(private streamView: AbstractStreamView) {}

	async readFileByCentralDirectoryEntry(
		centralDirectoryEntry: CentralDirectoryEntry
	) {
		const fileEntry = await this.readFileEntry(
			centralDirectoryEntry.firstByteAt,
			centralDirectoryEntry as any
		);
		return new File(
			[fileEntry!.bytes],
			new TextDecoder().decode(centralDirectoryEntry.path)
		);
	}

	async *listCentralDirectory() {
		const stream = new ConvenientStreamWrapper(
			await this.streamCentralDirectoryBytes(),
			this.streamView.length
		);
		while (true) {
			const entry = await this.readCentralDirectoryEntry(stream);
			if (!entry) {
				break;
			}
			yield entry;
		}
	}

	/**
	 * Reads a file entry from a zip file.
	 *
	 * The file entry is structured as follows:
	 *
	 * ```
	 * Offset	Bytes	Description
	 *   0		4	Local file header signature = 0x04034b50 (PK♥♦ or "PK\3\4")
	 *   4		2	Version needed to extract (minimum)
	 *   6		2	General purpose bit flag
	 *   8		2	Compression method; e.g. none = 0, DEFLATE = 8 (or "\0x08\0x00")
	 *   10		2	File last modification time
	 *   12		2	File last modification date
	 *   14		4	CRC-32 of uncompressed data
	 *   18		4	Compressed size (or 0xffffffff for ZIP64)
	 *   22		4	Uncompressed size (or 0xffffffff for ZIP64)
	 *   26		2	File name length (n)
	 *   28		2	Extra field length (m)
	 *   30		n	File name
	 *   30+n	m	Extra field
	 * ```
	 *
	 * @param stream
	 * @param skipSignature Do not consume the signature from the stream.
	 * @returns
	 */
	private async readFileEntry(
		start: number,
		headerOverrides: Partial<FileEntry> = {}
	): Promise<FileEntry | null> {
		const fixedHeaderEnd = start + 30;
		const headerStream = await this.streamView.slice(start, fixedHeaderEnd);

		const sigData = new DataView((await headerStream.read(4))!.buffer);
		const signature = sigData.getUint32(0, true);
		if (signature !== SIGNATURE_FILE) {
			return null;
		}
		const data = new DataView((await headerStream.read(26))!.buffer);
		const pathLength = data.getUint16(22, true);
		const extraLength = data.getUint16(24, true);
		const entry: Partial<FileEntry> = {
			signature: SIGNATURE_FILE,
			version: data.getUint32(0, true),
			generalPurpose: data.getUint16(2, true),
			compressionMethod: data.getUint16(4, true) as CompressionMethod,
			lastModifiedTime: data.getUint16(6, true),
			lastModifiedDate: data.getUint16(8, true),
			crc: data.getUint32(10, true),
			compressedSize: data.getUint32(14, true),
			uncompressedSize: data.getUint32(18, true),
			...headerOverrides,
		};

		const headerEnd = fixedHeaderEnd + extraLength + pathLength;
		const extraStream = await this.streamView.slice(
			fixedHeaderEnd,
			headerEnd
		);
		entry['path'] = await extraStream.read(pathLength);
		entry['pathString'] = new TextDecoder().decode(entry.path!);
		entry['isDirectory'] = endsWithSlash(entry.path!);
		entry['extra'] = await extraStream.read(extraLength);

		const bodyEnd = headerEnd + entry.compressedSize!;
		const bodyStream = await this.streamView.slice(headerEnd, bodyEnd);

		// Make sure we consume the body stream or else
		// we'll start reading the next file at the wrong
		// offset.
		// @TODO: Expose the body stream instead of reading it all
		//        eagerly. Ensure the next iteration exhausts
		//        the last body stream before moving on.
		if (entry['compressionMethod'] !== COMPRESSION_DEFLATE) {
			entry['bytes'] = await bodyStream.read(entry['compressedSize']!);
			return entry as FileEntry;
		}

		if (0 && true) {
			// For runtimes that support deflate-raw
			await bodyStream.addTransform(
				new DecompressionStream('deflate-raw')
			);
			entry['bytes'] = await bodyStream.read(entry['uncompressedSize']);
		} else {
			/**
			 * We want to write raw deflate-compressed bytes into our
			 * final ZIP file. CompressionStream supports "deflate-raw"
			 * compression, but not on Node.js v18.
			 *
			 * As a workaround, we use the "gzip" compression and add
			 * the header and footer bytes. It works, because "gzip"
			 * compression is the same as "deflate" compression plus
			 * the header and the footer.
			 *
			 * The header is 10 bytes long:
			 * - 2 magic bytes: 0x1f, 0x8b
			 * - 1 compression method: 0x08 (deflate)
			 * - 1 header flags
			 * - 4 mtime: 0x00000000 (no timestamp)
			 * - 1 compression flags
			 * - 1 OS: 0x03 (Unix)
			 *
			 * The footer is 8 bytes long:
			 * - 4 bytes for CRC32 of the uncompressed data
			 * - 4 bytes for ISIZE (uncompressed size modulo 2^32)
			 */
			const header = new Uint8Array(10);
			header.set([0x1f, 0x8b, 0x08]);

			const footer = new Uint8Array(8);
			const footerView = new DataView(footer.buffer);
			footerView.setUint32(0, entry.crc!, true);
			footerView.setUint32(4, entry.uncompressedSize! % 2 ** 32, true);

			const stream = ConvenientStreamWrapper.chain(
				ConvenientStreamWrapper.fromBytes(header),
				await this.streamView.slice(headerEnd, bodyEnd),
				ConvenientStreamWrapper.fromBytes(footer)
			);
			await stream.addTransform(new DecompressionStream('gzip'));
			entry['bytes'] = await stream.read(entry['uncompressedSize']!);

			console.log(entry['bytes'].byteLength, entry['uncompressedSize']!);
			const decoder = new ZipDecoder(
				new TeeStreamView(
					ConvenientStreamWrapper.fromBytes(
						entry['bytes']
					).streamRemainingBytes(),
					entry['uncompressedSize']!
				)
			);
			for await (const file of decoder.listCentralDirectory()) {
				console.log(file);
				break;
			}
		}

		return entry as FileEntry;
	}

	/**
	 * Reads a central directory entry from a zip file.
	 *
	 * The central directory entry is structured as follows:
	 *
	 * ```
	 * Offset Bytes Description
	 *   0		4	Central directory file header signature = 0x02014b50
	 *   4		2	Version made by
	 *   6		2	Version needed to extract (minimum)
	 *   8		2	General purpose bit flag
	 *   10		2	Compression method
	 *   12		2	File last modification time
	 *   14		2	File last modification date
	 *   16		4	CRC-32 of uncompressed data
	 *   20		4	Compressed size (or 0xffffffff for ZIP64)
	 *   24		4	Uncompressed size (or 0xffffffff for ZIP64)
	 *   28		2	File name length (n)
	 *   30		2	Extra field length (m)
	 *   32		2	File comment length (k)
	 *   34		2	Disk number where file starts (or 0xffff for ZIP64)
	 *   36		2	Internal file attributes
	 *   38		4	External file attributes
	 *   42		4	Relative offset of local file header (or 0xffffffff for ZIP64). This is the number of bytes between the start of the first disk on which the file occurs, and the start of the local file header. This allows software reading the central directory to locate the position of the file inside the ZIP file.
	 *   46		n	File name
	 *   46+n	m	Extra field
	 *   46+n+m	k	File comment
	 * ```
	 *
	 * @param stream
	 * @returns
	 */
	private async readCentralDirectoryEntry(
		stream: ConvenientStreamWrapper
	): Promise<CentralDirectoryEntry | null> {
		const sigData = new DataView((await stream.read(4))!.buffer);
		const signature = sigData.getUint32(0, true);
		if (signature !== SIGNATURE_CENTRAL_DIRECTORY) {
			return null;
		}
		const data = new DataView((await stream.read(42))!.buffer);
		const pathLength = data.getUint16(24, true);
		const extraLength = data.getUint16(26, true);
		const fileCommentLength = data.getUint16(28, true);
		const centralDirectory: Partial<CentralDirectoryEntry> = {
			signature: SIGNATURE_CENTRAL_DIRECTORY,
			versionCreated: data.getUint16(0, true),
			versionNeeded: data.getUint16(2, true),
			generalPurpose: data.getUint16(4, true),
			compressionMethod: data.getUint16(6, true) as CompressionMethod,
			lastModifiedTime: data.getUint16(8, true),
			lastModifiedDate: data.getUint16(10, true),
			crc: data.getUint32(12, true),
			compressedSize: data.getUint32(16, true),
			uncompressedSize: data.getUint32(20, true),
			diskNumber: data.getUint16(30, true),
			internalAttributes: data.getUint16(32, true),
			externalAttributes: data.getUint32(34, true),
			firstByteAt: data.getUint32(38, true),
		};
		centralDirectory['lastByteAt'] =
			centralDirectory.firstByteAt! +
			FILE_HEADER_SIZE +
			pathLength +
			fileCommentLength +
			extraLength! +
			centralDirectory.compressedSize! -
			1;

		centralDirectory['path'] = await stream.read(pathLength);
		centralDirectory['isDirectory'] = endsWithSlash(centralDirectory.path!);
		centralDirectory['extra'] = await stream.read(extraLength);
		centralDirectory['fileComment'] = await stream.read(fileCommentLength);
		return centralDirectory as CentralDirectoryEntry;
	}

	private async streamCentralDirectoryBytes() {
		const chunkSize = CENTRAL_DIRECTORY_END_SCAN_CHUNK_SIZE;
		let centralDirectory: Uint8Array = new Uint8Array();

		let chunkStart = this.streamView.length;
		let attempt = 0;
		do {
			if (++attempt > 3) {
				throw new Error();
			}
			chunkStart = Math.max(0, chunkStart - chunkSize);
			const chunkEnd = Math.min(
				chunkStart + chunkSize - 1,
				this.streamView.length - 1
			);
			const stream = await this.streamView.slice(chunkStart, chunkEnd);
			centralDirectory = await stream.read(chunkEnd - chunkStart);

			// Scan the buffer for the signature
			const view = new DataView(centralDirectory.buffer);
			for (let i = view.byteLength - 4; i >= 0; i--) {
				if (
					view.getUint32(i, true) !== SIGNATURE_CENTRAL_DIRECTORY_END
				) {
					continue;
				}

				// Confirm we have enough data to read the offset and the
				// length of the central directory.
				const centralDirectoryLengthAt = i + 12;
				const centralDirectoryOffsetAt = centralDirectoryLengthAt + 4;
				if (
					centralDirectory.byteLength <
					centralDirectoryOffsetAt + 4
				) {
					throw new Error('Central directory not found');
				}

				// Read where the central directory starts
				const dirStart = view.getUint32(centralDirectoryOffsetAt, true);
				if (dirStart < chunkStart) {
					const stream = await this.streamView.slice(
						dirStart,
						chunkStart - 1
					);
					centralDirectory = await stream.read(
						chunkStart - 1 - dirStart
					);
				} else if (dirStart > chunkStart) {
					centralDirectory = centralDirectory.slice(
						dirStart - chunkStart
					);
				}
				return new Blob([centralDirectory]).stream();
			}
		} while (chunkStart >= 0);

		throw new Error('Central directory not found');
	}
}

function endsWithSlash(path: Uint8Array) {
	return path[path.byteLength - 1] == '/'.charCodeAt(0);
}
