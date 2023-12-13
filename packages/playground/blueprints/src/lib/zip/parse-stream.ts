/**
 * Reads files from a stream of zip file bytes.
 */
import { IterableReadableStream } from './iterable-stream-polyfill';
import {
	collectBytes,
	collectString,
	concatBytes,
	filterStream,
	limitBytes,
} from './stream-utils';

export const FILE_HEADER_SIZE = 32;
export const SIGNATURE_FILE = 0x04034b50 as const;
export const SIGNATURE_CENTRAL_DIRECTORY_START = 0x02014b50 as const;
export const SIGNATURE_CENTRAL_DIRECTORY_END = 0x06054b50 as const;
export const SIGNATURE_DATA_DESCRIPTOR = 0x08074b50 as const;

const DEFAULT_PREDICATE = () => true;
export function zipEntriesStream(
	stream: ReadableStream<Uint8Array>,
	predicate: (
		dirEntry: CentralDirectoryEntry | FileEntry
	) => boolean = DEFAULT_PREDICATE
) {
	const entriesStream = new ReadableStream<ZipEntry>({
		async pull(controller) {
			try {
				const entry = await nextZipEntry(stream);
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
	}) as IterableReadableStream<ZipEntry>;

	return entriesStream
		.pipeThrough(
			filterStream(({ signature }) => signature === SIGNATURE_FILE)
		)
		.pipeThrough(
			filterStream(predicate as any)
		) as IterableReadableStream<FileEntry>;
}

async function nextZipEntry(stream: ReadableStream<Uint8Array>) {
	const sigData = new DataView((await collectBytes(stream, 4))!.buffer);
	const signature = sigData.getUint32(0, true);
	if (signature === SIGNATURE_FILE) {
		return await readFileEntry(stream, true);
	} else if (signature === SIGNATURE_CENTRAL_DIRECTORY_START) {
		return await readCentralDirectoryEntry(stream, true);
	} else if (signature === SIGNATURE_CENTRAL_DIRECTORY_END) {
		return await readEndCentralDirectoryEntry(stream, true);
	}
	return null;
}

export type ZipEntry =
	| FileEntry
	| CentralDirectoryEntry
	| CentralDirectoryEndEntry;

export interface FileEntry {
	signature: typeof SIGNATURE_FILE;
	startsAt?: number;
	extract?: any;
	version: number;
	generalPurpose: number;
	compressionMethod: number;
	lastModifiedTime: number;
	lastModifiedDate: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	pathLength: number;
	path: string;
	isDirectory: boolean;
	extraLength: number;
	extra: Uint8Array;
	text(): Promise<string>;
	bytes(): Promise<Uint8Array>;
}

export interface CentralDirectoryEntry {
	signature: typeof SIGNATURE_CENTRAL_DIRECTORY_START;
	versionCreated: number;
	versionNeeded: number;
	generalPurpose: number;
	compressionMethod: number;
	lastModifiedTime: number;
	lastModifiedDate: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	pathLength: number;
	extraLength: number;
	fileCommentLength: number;
	diskNumber: number;
	internalAttributes: number;
	externalAttributes: number;
	firstByteAt: number;
	lastByteAt: number;
	path: string;
	extra: Uint8Array;
	fileComment: string;
	isDirectory: boolean;
}

export interface CentralDirectoryEndEntry {
	signature: typeof SIGNATURE_CENTRAL_DIRECTORY_END;
	numberOfDisks: number;
	centralDirectoryStartDisk: number;
	numberCentralDirectoryRecordsOnThisDisk: number;
	numberCentralDirectoryRecords: number;
	centralDirectorySize: number;
	centralDirectoryOffset: number;
	commentLength: number;
	comment: string;
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
 * @param skipSignature
 * @returns
 */
export async function readFileEntry(
	stream: ReadableStream<Uint8Array>,
	skipSignature = false
): Promise<FileEntry | null> {
	if (!skipSignature) {
		const sigData = new DataView((await collectBytes(stream, 4))!.buffer);
		const signature = sigData.getUint32(0, true);
		if (signature !== SIGNATURE_FILE) {
			return null;
		}
	}
	const data = new DataView((await collectBytes(stream, 26))!.buffer);
	const entry: Partial<FileEntry> = {
		signature: SIGNATURE_FILE,
		version: data.getUint32(0, true),
		generalPurpose: data.getUint16(2, true),
		compressionMethod: data.getUint16(4, true),
		lastModifiedTime: data.getUint16(6, true),
		lastModifiedDate: data.getUint16(8, true),
		crc: data.getUint32(10, true),
		compressedSize: data.getUint32(14, true),
		uncompressedSize: data.getUint32(18, true),
		pathLength: data.getUint16(22, true),
		extraLength: data.getUint16(24, true),
	};

	entry['path'] = await collectString(stream, entry['pathLength']!);
	entry['isDirectory'] = entry.path!.endsWith('/');
	entry['extra'] = await collectBytes(stream, entry['extraLength']);

	// Make sure we consume the body stream or else
	// we'll start reading the next file at the wrong
	// offset.
	// @TODO: Expose the body stream instead of reading it all
	//        eagerly. Ensure the next iteration exhausts
	//        the last body stream before moving on.
	let bodyStream = limitBytes(stream, entry['compressedSize']!);
	if (entry['compressionMethod'] === 8) {
		bodyStream = bodyStream.pipeThrough(
			new DecompressionStream('deflate-raw')
		);
	}
	const body = await bodyStream
		.pipeThrough(concatBytes(entry['uncompressedSize']))
		.getReader()
		.read()
		.then(({ value }) => value!);
	entry['bytes'] = () => Promise.resolve(body);
	entry['text'] = () => Promise.resolve(new TextDecoder().decode(body));
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
		if (signature !== SIGNATURE_CENTRAL_DIRECTORY_START) {
			return null;
		}
	}
	const data = new DataView((await collectBytes(stream, 42))!.buffer);
	const centralDirectory: Partial<CentralDirectoryEntry> = {
		signature: SIGNATURE_CENTRAL_DIRECTORY_START,
		versionCreated: data.getUint16(0, true),
		versionNeeded: data.getUint16(2, true),
		generalPurpose: data.getUint16(4, true),
		compressionMethod: data.getUint16(6, true),
		lastModifiedTime: data.getUint16(8, true),
		lastModifiedDate: data.getUint16(10, true),
		crc: data.getUint32(12, true),
		compressedSize: data.getUint32(16, true),
		uncompressedSize: data.getUint32(20, true),
		pathLength: data.getUint16(24, true),
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
		centralDirectory.pathLength! +
		centralDirectory.fileCommentLength! +
		centralDirectory.extraLength! +
		centralDirectory.compressedSize! -
		1;

	centralDirectory['path'] = await collectString(
		stream,
		centralDirectory.pathLength!
	);
	centralDirectory['isDirectory'] = centralDirectory.path!.endsWith('/');
	centralDirectory['extra'] = await collectBytes(
		stream,
		centralDirectory.extraLength!
	);
	centralDirectory['fileComment'] = await collectString(
		stream,
		centralDirectory.fileCommentLength!
	);
	return centralDirectory as CentralDirectoryEntry;
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
		commentLength: data.getUint16(16, true),
	};
	endOfDirectory['comment'] = await collectString(
		stream,
		endOfDirectory.commentLength!
	);
	return endOfDirectory as CentralDirectoryEndEntry;
}
