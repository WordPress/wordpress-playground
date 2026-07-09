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
	stream?: () => ReadableStream<Uint8Array>;
	size?: number;
	filesize?: number;
};

/**
 * Classifies a file as inline-editable or too large for the editor.
 *
 * Uses known size metadata before reading when it is available. Stream-backed
 * files without a known size are read only until they cross the inline limit.
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

	if (typeof file.stream === 'function') {
		return readStreamForInlinePreview(file, maxInlineBytes);
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

/**
 * Returns the file size reported by browser and storage-backed file objects.
 */
function getKnownFileSize(file: BrowserReadableFile): number | undefined {
	if (typeof file.filesize === 'number') {
		return file.filesize;
	}
	if (typeof file.size === 'number') {
		return file.size;
	}
	return undefined;
}

/**
 * Reads a file stream only while it remains small enough for inline editing.
 *
 * The stream is canceled as soon as the accumulated bytes exceed the limit so
 * large files do not have to finish loading before the editor rejects them.
 */
async function readStreamForInlinePreview(
	file: BrowserReadableFile,
	maxInlineBytes: number
): Promise<InlineFilePreviewReadResult> {
	const reader = file.stream!().getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				return {
					type: 'inline',
					data: concatChunks(chunks, totalBytes),
				};
			}
			if (!value) {
				continue;
			}
			totalBytes += value.byteLength;
			if (totalBytes > maxInlineBytes) {
				await reader.cancel().catch(() => undefined);
				return {
					type: 'too-large',
					downloadUrl: createObjectUrlForNativeBlob(
						file,
						getKnownFileSize(file)
					),
				};
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Combines stream chunks that were already accepted for inline preview.
 */
function concatChunks(chunks: Uint8Array[], totalBytes: number) {
	const data = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return data;
}

/**
 * Creates a download URL only when the original file is a native Blob/File.
 *
 * This avoids copying large stream-backed files into memory just to preserve the
 * large-file download link.
 */
function createObjectUrlForNativeBlob(
	file: BrowserReadableFile,
	expectedSize: number | undefined
): string | undefined {
	// Native Blob/File objects can be downloaded without copying their bytes into
	// JavaScript. Stream-backed files need a streaming download path instead; do
	// not call arrayBuffer() here just to preserve the old download link.
	if (
		typeof Blob !== 'undefined' &&
		file instanceof Blob &&
		file.size === expectedSize
	) {
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
