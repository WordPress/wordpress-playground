/**
 * Reads files from a stream of zip file bytes.
 */
import { IterableReadableStream } from '../utils/iterable-stream-polyfill';

import {
	SIGNATURE_FILE,
	SIGNATURE_CENTRAL_DIRECTORY,
	SIGNATURE_CENTRAL_DIRECTORY_END,
	FILE_HEADER_SIZE,
	COMPRESSION_DEFLATE,
	CompressionMethod,
} from './types';
import {
	CentralDirectoryEntry,
	FileEntry,
	ZipEntry,
	CentralDirectoryEndEntry,
} from './types';
import { filterStream } from '../utils/filter-stream';
import { collectBytes } from '../utils/collect-bytes';
import { limitBytes } from '../utils/limit-bytes';
import { concatBytes } from '../utils/concat-bytes';
import { prependBytes } from '../utils/prepend-bytes';
import { appendBytes } from '../utils/append-bytes';

/**
 * Unzips a stream of zip file bytes.
 *
 * @param stream A stream of zip file bytes.
 * @param predicate Optional. A function that returns true if the file should be downloaded.
 * @returns An iterable stream of File objects.
 */
export function decodeZip(
	stream: ReadableStream<Uint8Array>,
	predicate: (
		dirEntry: CentralDirectoryEntry | FileEntry
	) => boolean = DEFAULT_PREDICATE
) {
	return streamZippedFileEntries(stream, predicate).pipeThrough(
		new TransformStream<FileEntry, File>({
			async transform(zipEntry, controller) {
				const file = new File(
					[zipEntry.bytes],
					new TextDecoder().decode(zipEntry.path),
					{
						type: zipEntry.isDirectory ? 'directory' : undefined,
					}
				);
				controller.enqueue(file);
			},
		})
	) as IterableReadableStream<File>;
}

const DEFAULT_PREDICATE = () => true;

/**
 * Parses a stream of zipped bytes into FileEntry informations.
 *
 * @param stream A stream of zip file bytes.
 * @param predicate Optional. A function that returns true if the file should be downloaded.
 * @returns An iterable stream of FileEntry objects.
 */
export function streamZippedFileEntries(
	stream: ReadableStream<Uint8Array>,
	predicate: (
		dirEntry: CentralDirectoryEntry | FileEntry
	) => boolean = DEFAULT_PREDICATE
) {
	const entriesStream = new ReadableStream<ZipEntry>({
		async pull(controller) {
			const entry = await nextZipEntry(stream);
			if (!entry) {
				controller.close();
				return;
			}
			controller.enqueue(entry);
		},
	}) as IterableReadableStream<ZipEntry>;

	return entriesStream
		.pipeThrough(
			filterStream(({ signature }) => signature === SIGNATURE_FILE)
		)
		.pipeThrough(
			filterStream(predicate as any)
		) as IterableReadableStream<FileEntry>;
}

/**
 * Reads the next zip entry from a stream of zip file bytes.
 *
 * @param stream A stream of zip file bytes.
 * @returns A FileEntry object.
 */
async function nextZipEntry(stream: ReadableStream<Uint8Array>) {
	const sigData = new DataView((await collectBytes(stream, 4))!.buffer);
	const signature = sigData.getUint32(0, true);
	if (signature === SIGNATURE_FILE) {
		return await readFileEntry(stream, true);
	} else if (signature === SIGNATURE_CENTRAL_DIRECTORY) {
		return await readCentralDirectoryEntry(stream, true);
	} else if (signature === SIGNATURE_CENTRAL_DIRECTORY_END) {
		return await readEndCentralDirectoryEntry(stream, true);
	}
	return null;
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
export async function readFileEntry(
	stream: ReadableStream<Uint8Array>,
	skipSignature = false,
	headerOverrides: Partial<FileEntry> = {}
): Promise<FileEntry | null> {
	if (!skipSignature) {
		const sigData = new DataView((await collectBytes(stream, 4))!.buffer);
		const signature = sigData.getUint32(0, true);
		if (signature !== SIGNATURE_FILE) {
			return null;
		}
	}
	const data = new DataView((await collectBytes(stream, 26))!.buffer);
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

	entry['path'] = await collectBytes(stream, pathLength);
	entry['isDirectory'] = endsWithSlash(entry.path!);
	entry['extra'] = await collectBytes(stream, extraLength);

	// Make sure we consume the body stream or else
	// we'll start reading the next file at the wrong
	// offset.
	// @TODO: Expose the body stream instead of reading it all
	//        eagerly. Ensure the next iteration exhausts
	//        the last body stream before moving on.
	let bodyStream = limitBytes(stream, entry['compressedSize']!);
	if (entry['compressionMethod'] === COMPRESSION_DEFLATE) {
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
		bodyStream = bodyStream
			.pipeThrough(prependBytes(header))
			.pipeThrough(appendBytes(footer))
			.pipeThrough(new DecompressionStream('gzip'));
	}
	entry['bytes'] = await bodyStream
		.pipeThrough(concatBytes(entry['uncompressedSize']))
		.getReader()
		.read()
		.then(({ value }) => value!);
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
 * @param skipSignature
 * @returns
 */
export async function readCentralDirectoryEntry(
	stream: ReadableStream<Uint8Array>,
	skipSignature = false
): Promise<CentralDirectoryEntry | null> {
	if (!skipSignature) {
		const sigData = new DataView((await collectBytes(stream, 4))!.buffer);
		const signature = sigData.getUint32(0, true);
		if (signature !== SIGNATURE_CENTRAL_DIRECTORY) {
			return null;
		}
	}
	const data = new DataView((await collectBytes(stream, 42))!.buffer);
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

	centralDirectory['path'] = await collectBytes(stream, pathLength);
	centralDirectory['isDirectory'] = endsWithSlash(centralDirectory.path!);
	centralDirectory['extra'] = await collectBytes(stream, extraLength);
	centralDirectory['fileComment'] = await collectBytes(
		stream,
		fileCommentLength
	);
	return centralDirectory as CentralDirectoryEntry;
}

function endsWithSlash(path: Uint8Array) {
	return path[path.byteLength - 1] == '/'.charCodeAt(0);
}

/**
 * Reads the end of central directory entry from a zip file.
 *
 * The end of central directory entry is structured as follows:
 *
 * ```
 * Offset	Bytes	Description[33]
 *   0		 4		End of central directory signature = 0x06054b50
 *   4		 2		Number of this disk (or 0xffff for ZIP64)
 *   6		 2		Disk where central directory starts (or 0xffff for ZIP64)
 *   8		 2		Number of central directory records on this disk (or 0xffff for ZIP64)
 *   10		 2		Total number of central directory records (or 0xffff for ZIP64)
 *   12		 4		Size of central directory (bytes) (or 0xffffffff for ZIP64)
 *   16		 4		Offset of start of central directory, relative to start of archive (or 0xffffffff for ZIP64)
 *   20		 2		Comment length (n)
 *   22		 n		Comment
 * ```
 *
 * @param stream
 * @param skipSignature
 * @returns
 */
async function readEndCentralDirectoryEntry(
	stream: ReadableStream<Uint8Array>,
	skipSignature = false
) {
	if (!skipSignature) {
		const sigData = new DataView((await collectBytes(stream, 4))!.buffer);
		const signature = sigData.getUint32(0, true);
		if (signature !== SIGNATURE_CENTRAL_DIRECTORY_END) {
			return null;
		}
	}
	const data = new DataView((await collectBytes(stream, 18))!.buffer);
	const endOfDirectory: Partial<CentralDirectoryEndEntry> = {
		signature: SIGNATURE_CENTRAL_DIRECTORY_END,
		numberOfDisks: data.getUint16(0, true),
		centralDirectoryStartDisk: data.getUint16(2, true),
		numberCentralDirectoryRecordsOnThisDisk: data.getUint16(4, true),
		numberCentralDirectoryRecords: data.getUint16(6, true),
		centralDirectorySize: data.getUint32(8, true),
		centralDirectoryOffset: data.getUint32(12, true),
	};
	const commentLength = data.getUint16(16, true);
	endOfDirectory['comment'] = await collectBytes(stream, commentLength);
	return endOfDirectory as CentralDirectoryEndEntry;
}
