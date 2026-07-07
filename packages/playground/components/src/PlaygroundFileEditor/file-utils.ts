import mimeTypes from '@php-wasm/universal/mime-types';

export const MAX_INLINE_FILE_BYTES = 1024 * 1024; // 1MB

/**
 * Checks if a buffer seems to contain binary data by looking for null bytes
 * in the first 4096 bytes and attempting to decode as UTF-8.
 */
export const seemsLikeBinary = (buffer: Uint8Array): boolean => {
	// Assume that anything with a null byte in the first 4096 bytes is binary.
	// This isn't a perfect test, but it catches a lot of binary files.
	const len = buffer.byteLength;
	for (let i = 0; i < Math.min(len, 4096); i++) {
		if (buffer[i] === 0) {
			return true;
		}
	}

	// Next, try to decode the buffer as UTF-8. If it fails, it's probably binary.
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(buffer);
		return false;
	} catch {
		return true;
	}
};

/**
 * Creates a download URL for a file and returns both the URL and filename.
 * The URL is automatically revoked after 60 seconds.
 */
export const createDownloadUrl = (
	data: Uint8Array,
	filename: string
): { url: string; filename: string } => {
	const blob = new Blob([data]);
	const url = URL.createObjectURL(blob);
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
	return { url, filename };
};

export type InlineFilePreviewReadResult =
	| { type: 'inline'; data: Uint8Array }
	| { type: 'too-large'; downloadUrl?: string };

type BrowserReadableFile = {
	arrayBuffer(): Promise<ArrayBuffer>;
	size?: number;
	filesize?: number;
};

/**
 * Reads a file for inline editing without buffering files that already report
 * they are larger than the editor limit.
 */
export async function readFileForInlinePreview(
	file: BrowserReadableFile,
	maxInlineBytes = MAX_INLINE_FILE_BYTES
): Promise<InlineFilePreviewReadResult> {
	const knownSize = getKnownFileSize(file);
	if (knownSize !== undefined && knownSize > maxInlineBytes) {
		return {
			type: 'too-large',
			downloadUrl: createObjectUrlForNativeBlob(file, knownSize),
		};
	}

	const data = new Uint8Array(await file.arrayBuffer());
	if (data.byteLength > maxInlineBytes) {
		return {
			type: 'too-large',
			downloadUrl: createObjectUrlForNativeBlob(file, data.byteLength),
		};
	}
	return { type: 'inline', data };
}

function getKnownFileSize(file: BrowserReadableFile): number | undefined {
	if (isValidFileSize(file.filesize)) {
		return file.filesize;
	}
	if (isValidFileSize(file.size)) {
		return file.size;
	}
	return undefined;
}

function isValidFileSize(size: unknown): size is number {
	return typeof size === 'number' && Number.isFinite(size) && size >= 0;
}

function createObjectUrlForNativeBlob(
	file: BrowserReadableFile,
	expectedSize: number
): string | undefined {
	if (file instanceof Blob && file.size === expectedSize) {
		const url = URL.createObjectURL(file);
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
		return url;
	}
	return undefined;
}

/**
 * Gets the MIME type for a filename based on its extension.
 */
export const getMimeType = (filename: string): string => {
	const extension = filename.split('.').pop() as keyof typeof mimeTypes;
	return mimeTypes[extension] || mimeTypes['_default'];
};

/**
 * Checks if a MIME type represents a binary file that can be previewed
 * (images, videos, audio).
 */
export const isPreviewableBinary = (mimeType: string): boolean => {
	return (
		mimeType.startsWith('image/') ||
		mimeType.startsWith('video/') ||
		mimeType.startsWith('audio/')
	);
};
