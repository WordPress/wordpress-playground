export const FILE_HEADER_SIZE = 32;
export const SIGNATURE_FILE = 67324752 as const;
export const SIGNATURE_CENTRAL_DIRECTORY = 33639248 as const;
export const SIGNATURE_CENTRAL_DIRECTORY_END = 101010256 as const;
export const SIGNATURE_DATA_DESCRIPTOR = 134695760 as const;

export type ZipEntry =
	| ZipFileEntry
	| CentralDirectoryEntry
	| CentralDirectoryEndEntry;

export interface ZipFileHeader {
	signature: typeof SIGNATURE_FILE;
	version: number;
	generalPurpose: number;
	compressionMethod: number;
	lastModifiedTime: number;
	lastModifiedDate: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	path: Uint8Array;
	extra: Uint8Array;
}
export interface ZipFileEntry extends ZipFileHeader {
	isDirectory: boolean;
	text(): Promise<string>;
	bytes(): Promise<Uint8Array>;
}

export interface CentralDirectoryEntry {
	signature: typeof SIGNATURE_CENTRAL_DIRECTORY;
	versionCreated: number;
	versionNeeded: number;
	generalPurpose: number;
	compressionMethod: number;
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
