export const FILE_HEADER_SIZE = 32;
export const SIGNATURE_FILE = 67324752 as const;
export const SIGNATURE_CENTRAL_DIRECTORY = 33639248 as const;
export const SIGNATURE_CENTRAL_DIRECTORY_END = 101010256 as const;
export const SIGNATURE_DATA_DESCRIPTOR = 134695760 as const;

export const COMPRESSION_NONE = 0 as const;
export const COMPRESSION_DEFLATE = 8 as const;
export type CompressionMethod =
	| typeof COMPRESSION_NONE
	| typeof COMPRESSION_DEFLATE;

export type ZipEntry =
	| FileEntry
	| CentralDirectoryEntry
	| CentralDirectoryEndEntry;

/**
 * Data of the file entry header encoded in a ".zip" file.
 */
export interface FileHeader {
	signature: typeof SIGNATURE_FILE;
	version: number;
	generalPurpose: number;
	compressionMethod: CompressionMethod;
	lastModifiedTime: number;
	lastModifiedDate: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	path: Uint8Array;
	extra: Uint8Array;
}
export interface FileEntry extends FileHeader {
	isDirectory: boolean;
	bytes: Uint8Array;
}

/**
 * Data of the central directory entry encoded in a ".zip" file.
 */
export interface CentralDirectoryEntry {
	signature: typeof SIGNATURE_CENTRAL_DIRECTORY;
	versionCreated: number;
	versionNeeded: number;
	generalPurpose: number;
	compressionMethod: CompressionMethod;
	lastModifiedTime: number;
	lastModifiedDate: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	diskNumber: number;
	internalAttributes: number;
	externalAttributes: number;
	firstByteAt: number;
	lastByteAt: number;
	path: Uint8Array;
	extra: Uint8Array;
	fileComment: Uint8Array;
	isDirectory: boolean;
}

/**
 * Data of the central directory end entry encoded in a ".zip" file.
 */
export interface CentralDirectoryEndEntry {
	signature: typeof SIGNATURE_CENTRAL_DIRECTORY_END;
	numberOfDisks: number;
	centralDirectoryStartDisk: number;
	numberCentralDirectoryRecordsOnThisDisk: number;
	numberCentralDirectoryRecords: number;
	centralDirectorySize: number;
	centralDirectoryOffset: number;
	comment: Uint8Array;
}
