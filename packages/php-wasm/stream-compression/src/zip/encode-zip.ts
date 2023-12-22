import {
	COMPRESSION_DEFLATE,
	COMPRESSION_NONE,
	CentralDirectoryEndEntry,
	CentralDirectoryEntry,
	FileHeader,
} from './types';
import {
	SIGNATURE_CENTRAL_DIRECTORY_END,
	SIGNATURE_CENTRAL_DIRECTORY,
	SIGNATURE_FILE,
} from './types';
import { iteratorToStream } from '../utils/iterator-to-stream';
import { collectBytes } from '../utils/collect-bytes';

/**
 * Compresses the given files into a ZIP archive.
 *
 * @param files - An async or sync iterable of files to be compressed.
 * @returns A readable stream of the compressed ZIP archive as Uint8Array chunks.
 */
export function encodeZip(
	files: AsyncIterable<File> | Iterable<File>
): ReadableStream<Uint8Array> {
	return iteratorToStream(files).pipeThrough(encodeZipTransform());
}

/**
 * Encodes the files into a ZIP format.
 *
 * @returns A stream transforming File objects into zipped bytes.
 */
function encodeZipTransform() {
	const offsetToFileHeaderMap: Map<number, FileHeader> = new Map();
	let writtenBytes = 0;
	return new TransformStream<File, Uint8Array>({
		async transform(file, controller) {
			const entryBytes = new Uint8Array(await file.arrayBuffer());
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
			let compressed = (await collectBytes(
				new Blob([entryBytes])
					.stream()
					.pipeThrough(new CompressionStream('gzip'))
			))!;
			// Grab the CRC32 hash from the footer.
			const crcHash = new DataView(compressed.buffer).getUint32(
				compressed.byteLength - 8,
				true
			);
			// Strip the header and the footer.
			compressed = compressed.slice(10, compressed.byteLength - 8);

			const encodedPath = new TextEncoder().encode(file.name);
			const zipFileEntry: FileHeader = {
				signature: SIGNATURE_FILE,
				version: 2,
				generalPurpose: 0,
				compressionMethod:
					file.type === 'directory' || compressed.byteLength === 0
						? COMPRESSION_NONE
						: COMPRESSION_DEFLATE,
				lastModifiedTime: 0,
				lastModifiedDate: 0,
				crc: crcHash,
				compressedSize: compressed.byteLength,
				uncompressedSize: entryBytes.byteLength,
				path: encodedPath,
				extra: new Uint8Array(0),
			};
			offsetToFileHeaderMap.set(writtenBytes, zipFileEntry);

			const headerBytes = encodeFileEntryHeader(zipFileEntry);
			controller.enqueue(headerBytes);
			writtenBytes += headerBytes.byteLength;

			controller.enqueue(compressed);
			writtenBytes += compressed.byteLength;
		},
		flush(controller) {
			const centralDirectoryOffset = writtenBytes;
			let centralDirectorySize = 0;
			for (const [
				fileOffset,
				header,
			] of offsetToFileHeaderMap.entries()) {
				const centralDirectoryEntry: Partial<CentralDirectoryEntry> = {
					...header,
					signature: SIGNATURE_CENTRAL_DIRECTORY,
					fileComment: new Uint8Array(0),
					diskNumber: 1,
					internalAttributes: 0,
					externalAttributes: 0,
					firstByteAt: fileOffset,
				};
				const centralDirectoryEntryBytes = encodeCentralDirectoryEntry(
					centralDirectoryEntry as CentralDirectoryEntry,
					fileOffset
				);
				controller.enqueue(centralDirectoryEntryBytes);
				centralDirectorySize += centralDirectoryEntryBytes.byteLength;
			}
			const centralDirectoryEnd: CentralDirectoryEndEntry = {
				signature: SIGNATURE_CENTRAL_DIRECTORY_END,
				numberOfDisks: 1,
				centralDirectoryOffset,
				centralDirectorySize,
				centralDirectoryStartDisk: 1,
				numberCentralDirectoryRecordsOnThisDisk:
					offsetToFileHeaderMap.size,
				numberCentralDirectoryRecords: offsetToFileHeaderMap.size,
				comment: new Uint8Array(0),
			};
			const centralDirectoryEndBytes =
				encodeCentralDirectoryEnd(centralDirectoryEnd);
			controller.enqueue(centralDirectoryEndBytes);
			offsetToFileHeaderMap.clear();
		},
	});
}

/**
 * Encodes a file entry header as a Uint8Array.
 *
 * The array is structured as follows:
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
 */
function encodeFileEntryHeader(entry: FileHeader) {
	const buffer = new ArrayBuffer(
		30 + entry.path.byteLength + entry.extra.byteLength
	);
	const view = new DataView(buffer);
	view.setUint32(0, entry.signature, true);
	view.setUint16(4, entry.version, true);
	view.setUint16(6, entry.generalPurpose, true);
	view.setUint16(8, entry.compressionMethod, true);
	view.setUint16(10, entry.lastModifiedDate, true);
	view.setUint16(12, entry.lastModifiedTime, true);
	view.setUint32(14, entry.crc, true);
	view.setUint32(18, entry.compressedSize, true);
	view.setUint32(22, entry.uncompressedSize, true);
	view.setUint16(26, entry.path.byteLength, true);
	view.setUint16(28, entry.extra.byteLength, true);
	const uint8Header = new Uint8Array(buffer);
	uint8Header.set(entry.path, 30);
	uint8Header.set(entry.extra, 30 + entry.path.byteLength);
	return uint8Header;
}

/**
 * Encodes a central directory entry as a Uint8Array.
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
 */
function encodeCentralDirectoryEntry(
	entry: CentralDirectoryEntry,
	fileEntryOffset: number
) {
	const buffer = new ArrayBuffer(
		46 + entry.path.byteLength + entry.extra.byteLength
	);
	const view = new DataView(buffer);
	view.setUint32(0, entry.signature, true);
	view.setUint16(4, entry.versionCreated, true);
	view.setUint16(6, entry.versionNeeded, true);
	view.setUint16(8, entry.generalPurpose, true);
	view.setUint16(10, entry.compressionMethod, true);
	view.setUint16(12, entry.lastModifiedDate, true);
	view.setUint16(14, entry.lastModifiedTime, true);
	view.setUint32(16, entry.crc, true);
	view.setUint32(20, entry.compressedSize, true);
	view.setUint32(24, entry.uncompressedSize, true);
	view.setUint16(28, entry.path.byteLength, true);
	view.setUint16(30, entry.extra.byteLength, true);
	view.setUint16(32, entry.fileComment.byteLength, true);
	view.setUint16(34, entry.diskNumber, true);
	view.setUint16(36, entry.internalAttributes, true);
	view.setUint32(38, entry.externalAttributes, true);
	view.setUint32(42, fileEntryOffset, true);
	const uint8Header = new Uint8Array(buffer);
	uint8Header.set(entry.path, 46);
	uint8Header.set(entry.extra, 46 + entry.path.byteLength);
	return uint8Header;
}

/**
 * Encodes the end of central directory entry as a Uint8Array.
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
 */
function encodeCentralDirectoryEnd(entry: CentralDirectoryEndEntry) {
	const buffer = new ArrayBuffer(22 + entry.comment.byteLength);
	const view = new DataView(buffer);
	view.setUint32(0, entry.signature, true);
	view.setUint16(4, entry.numberOfDisks, true);
	view.setUint16(6, entry.centralDirectoryStartDisk, true);
	view.setUint16(8, entry.numberCentralDirectoryRecordsOnThisDisk, true);
	view.setUint16(10, entry.numberCentralDirectoryRecords, true);
	view.setUint32(12, entry.centralDirectorySize, true);
	view.setUint32(16, entry.centralDirectoryOffset, true);
	view.setUint16(20, entry.comment.byteLength, true);
	const uint8Header = new Uint8Array(buffer);
	uint8Header.set(entry.comment, 22);
	return uint8Header;
}
