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
 * The caller owns the returned URL and must revoke it when the rendered link or
 * preview goes away.
 */
export const createDownloadUrl = (
	data: Uint8Array,
	filename: string
): { url: string; filename: string } => {
	const blob = new Blob([data]);
	const url = URL.createObjectURL(blob);
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
 * Reads a file for inline editing without buffering streams that already report
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

function getKnownFileSize(file: BrowserReadableFile): number | undefined {
	if (typeof file.filesize === 'number') {
		return file.filesize;
	}
	if (typeof file.size === 'number') {
		return file.size;
	}
	return undefined;
}

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
					downloadUrl: createObjectUrlForNativeBlob(file, totalBytes),
				};
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
}

function concatChunks(chunks: Uint8Array[], totalBytes: number) {
	const data = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return data;
}

function createObjectUrlForNativeBlob(
	file: BrowserReadableFile,
	expectedSize: number
): string | undefined {
	if (file instanceof Blob && file.size === expectedSize) {
		return URL.createObjectURL(file);
	}
	return undefined;
}

/**
 * Gets the MIME type for a filename based on its extension.
 */
export const getMimeType = (filename: string): string => {
	const extension = filename
		.split('.')
		.pop()
		?.toLowerCase() as keyof typeof mimeTypes;
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
