import type { Filesystem } from './filesystems';
import {
	InMemoryFilesystem,
	InMemoryFilesystemBackend,
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

describe('InMemoryFilesystemBackend', () => {
	let backend: InMemoryFilesystemBackend;

	beforeEach(() => {
		backend = new InMemoryFilesystemBackend();
	});

	describe('fileExists', () => {
		it('should return true for root directory', async () => {
			expect(await backend.fileExists('/')).toBe(true);
		});

		it('should return true for existing files', async () => {
			await backend.writeFile('/test.txt', new Uint8Array([1, 2, 3]));
			expect(await backend.fileExists('/test.txt')).toBe(true);
		});

		it('should return true for existing directories', async () => {
			await backend.mkdir('/mydir');
			expect(await backend.fileExists('/mydir')).toBe(true);
		});

		it('should return false for non-existent paths', async () => {
			expect(await backend.fileExists('/nonexistent')).toBe(false);
		});

		it('should return true for nested directories', async () => {
			await backend.mkdir('/parent/child', true);
			expect(await backend.fileExists('/parent')).toBe(true);
			expect(await backend.fileExists('/parent/child')).toBe(true);
		});
	});

	describe('isDir', () => {
		it('should return true for root directory', async () => {
			expect(await backend.isDir('/')).toBe(true);
		});

		it('should return true for directories', async () => {
			await backend.mkdir('/mydir');
			expect(await backend.isDir('/mydir')).toBe(true);
		});

		it('should return false for files', async () => {
			await backend.writeFile('/test.txt', new Uint8Array([1, 2, 3]));
			expect(await backend.isDir('/test.txt')).toBe(false);
		});

		it('should return false for non-existent paths', async () => {
			expect(await backend.isDir('/nonexistent')).toBe(false);
		});
	});

	describe('mkdir', () => {
		it('should create a directory', async () => {
			await backend.mkdir('/newdir');
			expect(await backend.isDir('/newdir')).toBe(true);
		});

		it('should throw when creating nested directories without recursive flag', async () => {
			await expect(
				backend.mkdir('/parent/child/grandchild')
			).rejects.toThrow();
		});

		it('should create nested directories with recursive flag', async () => {
			await backend.mkdir('/parent/child/grandchild', true);
			expect(await backend.isDir('/parent')).toBe(true);
			expect(await backend.isDir('/parent/child')).toBe(true);
			expect(await backend.isDir('/parent/child/grandchild')).toBe(true);
		});

		it('should not fail when directory already exists', async () => {
			await backend.mkdir('/mydir');
			await backend.mkdir('/mydir');
			expect(await backend.isDir('/mydir')).toBe(true);
		});

		it('should be a no-op for root directory', async () => {
			// mkdir('/') should not throw, root always exists
			await backend.mkdir('/');
			expect(await backend.isDir('/')).toBe(true);
		});
	});

	describe('writeFile and read', () => {
		it('should write and read a file', async () => {
			const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
			await backend.writeFile('/test.txt', data);

			const file = await backend.read('/test.txt');
			const content = new Uint8Array(await file.arrayBuffer());
			expect(content).toEqual(data);
		});

		it('should throw when parent directory does not exist', async () => {
			const data = new Uint8Array([1, 2, 3]);
			await expect(
				backend.writeFile('/nonexistent/file.txt', data)
			).rejects.toThrow();
		});

		it('should write to existing nested directory', async () => {
			await backend.mkdir('/deep/nested', true);
			const data = new Uint8Array([1, 2, 3]);
			await backend.writeFile('/deep/nested/file.txt', data);
			expect(await backend.fileExists('/deep/nested/file.txt')).toBe(
				true
			);
		});
	});

	describe('listFiles', () => {
		it('should list files in root directory', async () => {
			await backend.writeFile('/file1.txt', new Uint8Array([1]));
			await backend.writeFile('/file2.txt', new Uint8Array([2]));
			await backend.mkdir('/dir1');

			const files = await backend.listFiles('/');
			expect(files).toContain('file1.txt');
			expect(files).toContain('file2.txt');
			expect(files).toContain('dir1');
		});

		it('should list files in subdirectory', async () => {
			await backend.mkdir('/mydir');
			await backend.writeFile('/mydir/nested.txt', new Uint8Array([1]));

			const files = await backend.listFiles('/mydir');
			expect(files).toContain('nested.txt');
		});

		it('should return empty array for non-existent paths', async () => {
			const files = await backend.listFiles('/nonexistent');
			expect(files).toEqual([]);
		});

		it('should return empty array when listing a file path', async () => {
			await backend.writeFile('/file.txt', new Uint8Array([1]));
			const files = await backend.listFiles('/file.txt');
			expect(files).toEqual([]);
		});

		it('should not write LLVM profiling data at runtime', async () => {
			const files = await backend.listFiles('/');
			expect(files).not.toContain('default.profraw');
		});
	});

	describe('unlink', () => {
		it('should delete a file', async () => {
			await backend.writeFile('/test.txt', new Uint8Array([1]));
			expect(await backend.fileExists('/test.txt')).toBe(true);

			await backend.unlink('/test.txt');
			expect(await backend.fileExists('/test.txt')).toBe(false);
		});
	});

	describe('rmdir', () => {
		it('should delete an empty directory', async () => {
			await backend.mkdir('/emptydir');
			await backend.rmdir('/emptydir', false);
			expect(await backend.fileExists('/emptydir')).toBe(false);
		});

		it('should delete a directory recursively', async () => {
			await backend.mkdir('/parent/child', true);
			await backend.writeFile(
				'/parent/child/file.txt',
				new Uint8Array([1])
			);

			await backend.rmdir('/parent', true);
			expect(await backend.fileExists('/parent')).toBe(false);
		});

		it('should throw when deleting non-empty directory without recursive flag', async () => {
			await backend.mkdir('/parent');
			await backend.writeFile('/parent/file.txt', new Uint8Array([1]));

			await expect(backend.rmdir('/parent', false)).rejects.toThrow(
				'Directory not empty'
			);
		});
	});

	describe('mv', () => {
		it('should move a file', async () => {
			await backend.writeFile('/source.txt', new Uint8Array([1, 2, 3]));
			await backend.mv('/source.txt', '/dest.txt');

			expect(await backend.fileExists('/source.txt')).toBe(false);
			expect(await backend.fileExists('/dest.txt')).toBe(true);
		});

		it('should move a directory', async () => {
			await backend.mkdir('/srcdir');
			await backend.writeFile('/srcdir/file.txt', new Uint8Array([1]));
			await backend.mv('/srcdir', '/dstdir');

			expect(await backend.fileExists('/srcdir')).toBe(false);
			expect(await backend.fileExists('/dstdir')).toBe(true);
			expect(await backend.fileExists('/dstdir/file.txt')).toBe(true);
		});
	});

	describe('clear', () => {
		it('should remove all files and directories', async () => {
			await backend.mkdir('/dir1');
			await backend.writeFile('/file1.txt', new Uint8Array([1]));
			await backend.writeFile('/dir1/nested.txt', new Uint8Array([2]));

			await backend.clear();

			const files = await backend.listFiles('/');
			expect(files).toHaveLength(0);
		});
	});
});
