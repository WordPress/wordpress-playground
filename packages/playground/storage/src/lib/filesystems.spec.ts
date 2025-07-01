import type { Filesystem } from './filesystems';
import {
	InMemoryFilesystem,
	ZipFilesystem,
	OverlayFilesystem,
	FetchFilesystem,
	NodeJsFilesystem,
} from './filesystems';
import { StreamedFile } from '@php-wasm/stream-compression';
import type { FileTree } from '@php-wasm/universal';
import type { BlobReader, ZipReader } from '@zip.js/zip.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import path from 'path';

// Mock fetch for FetchFilesystem tests
global.fetch = vi.fn();

describe('InMemoryFilesystem', () => {
	let fileTree: FileTree;
	let filesystem: InMemoryFilesystem;

	beforeEach(() => {
		fileTree = {
			'file.txt': 'Hello, world!',
			'binary.bin': new Uint8Array([1, 2, 3, 4, 5]),
			folder: {
				'nested.txt': 'Nested content',
			},
		};
		filesystem = new InMemoryFilesystem(fileTree);
	});

	it('should read a text file', async () => {
		const file = await filesystem.read('file.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToString(file.stream());
		expect(content).toBe('Hello, world!');
	});

	it('should read a binary file', async () => {
		const file = await filesystem.read('binary.bin');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToUint8Array(file.stream());
		expect(content).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
	});

	it('should read a nested file', async () => {
		const file = await filesystem.read('folder/nested.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToString(file.stream());
		expect(content).toBe('Nested content');
	});

	it('should throw an error for non-existent files', async () => {
		await expect(filesystem.read('non-existent.txt')).rejects.toThrow(
			'File not found'
		);
	});

	it('should throw an error for unsupported content types', async () => {
		const badFileTree = {
			'bad.txt': {}, // Object that is neither string nor Uint8Array
		};
		const badFs = new InMemoryFilesystem(badFileTree);
		await expect(badFs.read('bad.txt')).rejects.toThrow(
			'Unsupported content type'
		);
	});
});

describe('ZipFilesystem', () => {
	// For ZipFilesystem, we would need to mock the ZipReader
	// This is a simplified test that mocks the necessary components

	let mockZipReader: ZipReader<BlobReader>;
	let filesystem: ZipFilesystem;

	beforeEach(() => {
		// Mock entries for the zip
		const mockEntries = [
			{
				filename: 'file.txt',
				getData: vi.fn().mockResolvedValue(new Blob(['Hello, world!'])),
				uncompressedSize: 13,
			},
			{
				filename: 'folder/nested.txt',
				getData: vi
					.fn()
					.mockResolvedValue(new Blob(['Nested content'])),
				uncompressedSize: 14,
			},
		];

		// Mock the ZipReader
		mockZipReader = {
			getEntries: vi.fn().mockResolvedValue(mockEntries),
		} as unknown as ZipReader<BlobReader>;

		filesystem = new ZipFilesystem(mockZipReader);
	});

	it('should read a file from the zip', async () => {
		const file = await filesystem.read('file.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToString(file.stream());
		expect(content).toBe('Hello, world!');
	});

	it('should read a nested file from the zip', async () => {
		const file = await filesystem.read('folder/nested.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToString(file.stream());
		expect(content).toBe('Nested content');
	});

	it('should throw an error for non-existent files', async () => {
		await expect(filesystem.read('non-existent.txt')).rejects.toThrow(
			'not found in the zip'
		);
	});

	it('should cache entries after the first read', async () => {
		await filesystem.read('file.txt');
		await filesystem.read('folder/nested.txt');

		// getEntries should only be called once
		expect(mockZipReader.getEntries).toHaveBeenCalledTimes(1);
	});
});

describe('OverlayFilesystem', () => {
	let primaryFs: Filesystem;
	let fallbackFs: Filesystem;
	let overlayFs: OverlayFilesystem;

	beforeEach(() => {
		// Create mock filesystems
		primaryFs = {
			read: vi.fn().mockImplementation(async (path: string) => {
				if (path === 'primary.txt') {
					return createMockStreamedFile('Primary content', path);
				}
				throw new Error('File not found in primary');
			}),
		};

		fallbackFs = {
			read: vi.fn().mockImplementation(async (path: string) => {
				if (path === 'fallback.txt') {
					return createMockStreamedFile('Fallback content', path);
				}
				throw new Error('File not found in fallback');
			}),
		};

		overlayFs = new OverlayFilesystem([primaryFs, fallbackFs]);
	});

	it('should require at least one filesystem', () => {
		expect(() => new OverlayFilesystem([])).toThrow(
			'requires at least one filesystem'
		);
	});

	it('should read from the primary filesystem if available', async () => {
		const file = await overlayFs.read('primary.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToString(file.stream());
		expect(content).toBe('Primary content');

		// Should only try the primary filesystem
		expect(primaryFs.read).toHaveBeenCalledTimes(1);
		expect(fallbackFs.read).not.toHaveBeenCalled();
	});

	it('should fall back to the secondary filesystem', async () => {
		const file = await overlayFs.read('fallback.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToString(file.stream());
		expect(content).toBe('Fallback content');

		// Should try both filesystems
		expect(primaryFs.read).toHaveBeenCalledTimes(1);
		expect(fallbackFs.read).toHaveBeenCalledTimes(1);
	});

	it('should throw an error if all filesystems fail', async () => {
		await expect(overlayFs.read('non-existent.txt')).rejects.toThrow(
			'Failed to read'
		);

		// Error message should include all underlying errors
		await expect(overlayFs.read('non-existent.txt')).rejects.toThrow(
			'File not found in primary'
		);
		await expect(overlayFs.read('non-existent.txt')).rejects.toThrow(
			'File not found in fallback'
		);

		// Should try all filesystems
		expect(primaryFs.read).toHaveBeenCalledTimes(3);
		expect(fallbackFs.read).toHaveBeenCalledTimes(3);
	});
});

describe('FetchFilesystem', () => {
	let filesystem: FetchFilesystem;

	beforeEach(() => {
		// Reset the mock
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockReset();

		filesystem = new FetchFilesystem({
			baseUrl: 'https://example.com/files/',
		});
	});

	it('should fetch a file from a URL', async () => {
		// Mock the fetch response
		const mockResponse = new Response('File content', {
			status: 200,
			headers: { 'content-length': '12' },
		});
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse
		);

		const file = await filesystem.read('test.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		// Check that fetch was called with the correct URL
		expect(global.fetch).toHaveBeenCalledWith(
			'https://example.com/files/test.txt'
		);

		const content = await streamToString(file.stream());
		expect(content).toBe('File content');
		expect(file.filesize).toBe(12);
	});

	it('should handle relative paths when baseUrl path ends with a slash', async () => {
		// Mock the fetch response
		const mockResponse = new Response('Nested content', {
			status: 200,
		});
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse
		);

		await filesystem.read('folder/nested.txt');

		// Check that fetch was called with the correct URL
		expect(global.fetch).toHaveBeenCalledWith(
			'https://example.com/files/folder/nested.txt'
		);
	});

	it('should handle relative paths when baseUrl path does not end with a slash', async () => {
		filesystem = new FetchFilesystem({
			baseUrl:
				'https://example.com/my-blueprint/blueprint.json?_cacheBuster=15438972',
		});
		// Mock the fetch response
		const mockResponse = new Response('Nested content', {
			status: 200,
		});
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse
		);

		await filesystem.read('folder/nested.txt');

		// Check that fetch was called with the correct URL
		expect(global.fetch).toHaveBeenCalledWith(
			'https://example.com/my-blueprint/folder/nested.txt'
		);
	});

	it('should handle paths with leading slashes', async () => {
		// Mock the fetch response
		const mockResponse = new Response('Content', {
			status: 200,
		});
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse
		);

		await filesystem.read('/test.txt');

		// Check that fetch was called with the correct URL (without double slashes)
		expect(global.fetch).toHaveBeenCalledWith(
			'https://example.com/files/test.txt'
		);
	});

	it('should use a CORS proxy if provided', async () => {
		const proxyFs = new FetchFilesystem({
			baseUrl: 'https://example.com/files/',
			corsProxy: 'https://proxy.example.com/',
		});

		// Mock the fetch response
		const mockResponse = new Response('Proxied content', {
			status: 200,
		});
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse
		);

		await proxyFs.read('test.txt');

		// Check that fetch was called with the proxied URL
		expect(global.fetch).toHaveBeenCalledWith(
			'https://proxy.example.com/https%3A%2F%2Fexample.com%2Ffiles%2Ftest.txt'
		);
	});

	it('should throw an error if the base URL is not a valid URL', () => {
		expect(
			() => new FetchFilesystem({ baseUrl: 'not-a-valid-url' })
		).toThrow('Invalid URL');
	});

	it('should refuse to read a file outside of the base URL', async () => {
		await expect(filesystem.read('../../test.txt')).rejects.toThrow(
			'Refused to read a file outside of the base URL'
		);
	});

	it('should reject non-HTTP non-HTTPS URLs', () => {
		expect(
			() => new FetchFilesystem({ baseUrl: 'file:///etc/passwd' })
		).toThrow(
			'Unsupported protocol: file:. Only HTTP and HTTPS are supported.'
		);
	});

	it('should throw an error for failed requests', async () => {
		// Mock a failed fetch response
		const mockResponse = new Response('Not Found', {
			status: 404,
			statusText: 'Not Found',
		});
		(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockResponse
		);

		await expect(filesystem.read('missing.txt')).rejects.toThrow(
			'Failed to fetch file'
		);
		await expect(filesystem.read('missing.txt')).rejects.toThrow(
			'Not Found'
		);
	});
});

// Helper functions for testing
async function streamToString(
	stream: ReadableStream<Uint8Array>
): Promise<string> {
	const reader = stream.getReader();
	let result = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		result += new TextDecoder().decode(value);
	}

	return result;
}

async function streamToUint8Array(
	stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let totalLength = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		totalLength += value.length;
	}

	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result;
}

function createMockStreamedFile(content: string, path: string): StreamedFile {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(data);
			controller.close();
		},
	});

	return new StreamedFile(stream, path, {
		filesize: data.byteLength,
	});
}

describe('NodeJsFilesystem', () => {
	let filesystem: NodeJsFilesystem;

	beforeEach(() => {
		filesystem = new NodeJsFilesystem(
			path.join(__dirname, '..', '..', 'tests', 'fixtures')
		);
	});

	it('should read a file from the local file system', async () => {
		const file = await filesystem.read('pygmalion.txt');
		expect(file).toBeInstanceOf(StreamedFile);

		const content = await streamToString(file.stream());
		expect(content).toBe('PREFACE TO PYGMALION.\n\n');
	});

	it('should throw an error if the file is outside the root directory', async () => {
		await expect(filesystem.read('../../pygmalion.txt')).rejects.toThrow(
			'Refused to read a file outside of the root directory'
		);
	});
});
