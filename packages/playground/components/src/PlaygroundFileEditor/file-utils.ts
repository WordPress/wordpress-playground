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
