import { StreamedFile } from '@php-wasm/stream-compression';
import type { FileTree } from '@php-wasm/universal';
import { normalizePath } from '@php-wasm/util';
import type { Entry } from '@zip.js/zip.js';
import { ZipReader, BlobWriter, BlobReader } from '@zip.js/zip.js';

export interface Filesystem {
	read(path: string): Promise<StreamedFile>;
}

export class InMemoryFilesystem implements Filesystem {
	private fileTree: FileTree;

	constructor(fileTree: FileTree) {
		this.fileTree = fileTree;
	}

	async read(path: string): Promise<StreamedFile> {
		let content = this.getEntryAtPath(path);
		if (typeof content === 'string') {
			content = new TextEncoder().encode(content);
		} else if (!(content instanceof Uint8Array)) {
			throw new Error(`Unsupported content type: ${typeof content}`);
		}
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(content);
				controller.close();
			},
		});
		return new StreamedFile(stream, path, {
			filesize: content.byteLength,
		});
	}

	private getEntryAtPath(path: string): Uint8Array | string | FileTree {
		let remainingPath = path.replace(/^\//, '');
		let currentSubtree = this.fileTree;
		while (remainingPath) {
			if (currentSubtree[remainingPath]) {
				return currentSubtree[remainingPath];
			}
			const segments = remainingPath.split('/');
			const nextSegment = segments.shift();
			if (!nextSegment || !currentSubtree[nextSegment]) {
				break;
			}
			currentSubtree = currentSubtree[nextSegment] as FileTree;
			remainingPath = segments.join('/');
		}
		throw new Error(`File not found at ${path}`);
	}
}

export class ZipFilesystem implements Filesystem {
	private entries: Map<string, Entry> = new Map();
	private zipReader: ZipReader<BlobReader>;

	static fromStream(stream: ReadableStream<Uint8Array>): ZipFilesystem {
		const zipReader = new ZipReader(
			new BlobReader(new StreamedFile(stream, 'archive.zip'))
		);
		return new ZipFilesystem(zipReader);
	}

	static fromArrayBuffer(arrayBuffer: ArrayBuffer): ZipFilesystem {
		const zipReader = new ZipReader(
			new BlobReader(new Blob([arrayBuffer]))
		);
		return new ZipFilesystem(zipReader);
	}

	constructor(zipReader: ZipReader<BlobReader>) {
		this.zipReader = zipReader;
	}

	async read(relativePath: string): Promise<StreamedFile> {
		const entry = await this.getEntry(relativePath);
		const blob = await entry.getData!(new BlobWriter());
		return new StreamedFile(blob.stream(), relativePath, {
			filesize: entry.uncompressedSize,
		});
	}

	private async getEntry(relativePath: string): Promise<Entry> {
		const entries = await this.getEntries();
		const entry = entries.get(relativePath.replace(/^\//, ''));
		if (!entry) {
			throw new Error(`File ${relativePath} not found in the zip.`);
		}
		return entry;
	}

	private async getEntries(): Promise<Map<string, Entry>> {
		if (this.entries.size === 0) {
			const entries = await this.zipReader.getEntries();
			for (const entry of entries) {
				this.entries.set(entry.filename, entry);
			}
		}
		return this.entries;
	}
}

/**
 * A Filesystem implementation that cascades through multiple filesystems
 * and returns the first successful result.
 *
 * This is useful for creating a layered approach to file resolution,
 * such as checking a local cache before fetching from a remote source.
 */
export class OverlayFilesystem implements Filesystem {
	private filesystems: Filesystem[];

	/**
	 * Creates a new OverlayFilesystem.
	 *
	 * @param filesystems An array of Filesystem instances to cascade through.
	 *                    The order determines the priority - earlier filesystems
	 *                    are checked first.
	 */
	constructor(filesystems: Filesystem[]) {
		if (!filesystems.length) {
			throw new Error(
				'OverlayFilesystem requires at least one filesystem'
			);
		}
		this.filesystems = filesystems;
	}

	/**
	 * Reads a file by trying each filesystem in order until one succeeds.
	 *
	 * @param path The path to the file to read.
	 * @returns A Promise that resolves to a StreamedFile from the first
	 *          filesystem that successfully resolves the path.
	 * @throws Error if all filesystems fail to resolve the path.
	 */
	async read(path: string): Promise<StreamedFile> {
		const errors: Error[] = [];

		// Try each filesystem in order
		for (const filesystem of this.filesystems) {
			try {
				return await filesystem.read(path);
			} catch (error) {
				// Collect the error and continue to the next filesystem
				errors.push(
					error instanceof Error ? error : new Error(String(error))
				);
			}
		}

		// If we get here, all filesystems failed
		const errorMessages = errors.map((e) => e.message).join('; ');
		throw new Error(
			`Failed to read ${path} from any filesystem: ${errorMessages}`,
			{ cause: errors }
		);
	}
}

export interface FetchFilesystemOptions {
	corsProxy?: string;
	baseUrl: string;
}

/**
 * A Filesystem implementation that fetches files from URLs.
 * It can optionally use a CORS proxy and resolve paths relative to a base URL.
 */
export class FetchFilesystem implements Filesystem {
	private baseUrl = '';
	private options: FetchFilesystemOptions;
	private isDataUrl: boolean;

	constructor(options: FetchFilesystemOptions) {
		this.options = options;
		this.isDataUrl = options.baseUrl.startsWith('data:');
		if (this.isDataUrl) {
			return;
		}
		// Ensure the base URL ends with a slash
		const url = new URL('./', options.baseUrl);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error(
				'Unsupported protocol: ' +
					url.protocol +
					'. Only HTTP and HTTPS are supported.'
			);
		}
		this.baseUrl = url.origin + url.pathname;
	}

	async read(path: string): Promise<StreamedFile> {
		if (this.isDataUrl) {
			throw new Error(
				'FetchFilesystem cannot fetch files from data URLs'
			);
		}

		// Make sure there's no .. segments in the path
		path = normalizePath(path);
		// Prevent escaping the base URL
		const cleanPath = path.replace(/^\//, '');

		// Resolve path to a URL
		const url = new URL(cleanPath, this.baseUrl).toString();
		if (!url.startsWith(this.baseUrl)) {
			throw new Error(
				`Refused to read a file outside of the base URL: ${url}`
			);
		}

		// Apply CORS proxy if configured
		const finalUrl = this.options.corsProxy
			? `${this.options.corsProxy}${encodeURIComponent(url)}`
			: url;

		// Fetch the file
		const response = await fetch(finalUrl);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch file at ${path}: ${response.statusText}`
			);
		}

		// Get the content length if available
		const filesize = response.headers.get('content-length')
			? parseInt(response.headers.get('content-length')!, 10)
			: undefined;

		// Return as a StreamedFile
		return new StreamedFile(response.body!, path, { filesize });
	}
}

/**
 * A Filesystem implementation that uses the "fs" and "path" modules from Node.js
 * to read files from the local file system.
 *
 * This is only available in a local environment.
 */
export class NodeJsFilesystem implements Filesystem {
	private fs: any;
	private path: any;
	private root: string;

	constructor(root: string) {
		this.root = root;
	}

	private async ensureNodeModules() {
		if (!this.fs || !this.path) {
			try {
				this.fs = await import('fs');
				this.path = await import('path');
			} catch {
				this.fs = require('fs');
				this.path = require('path');
			}
			this.root = this.path.resolve(this.root) + this.path.sep;
		}
	}

	async read(filePath: string): Promise<StreamedFile> {
		await this.ensureNodeModules();

		filePath = this.path.resolve(
			this.root,
			this.path.normalize(filePath.replace(/^\//, ''))
		);
		if (!filePath.startsWith(this.root)) {
			throw new Error(
				`Refused to read a file outside of the root directory: ${filePath}`
			);
		}

		return new Promise((resolve, reject) => {
			const fullPath = this.path.resolve(filePath);
			const stream = this.fs.createReadStream(fullPath);

			stream.on('error', (err: any) => {
				reject(
					new Error(
						`Failed to read file at ${filePath}: ${err.message}`
					)
				);
			});

			this.fs.stat(fullPath, (err: any, stats: any) => {
				if (err) {
					reject(
						new Error(
							`Failed to read file at ${filePath}: ${err.message}`
						)
					);
				} else {
					resolve(
						new StreamedFile(
							nodeStreamToReadableStream(stream),
							filePath,
							{
								filesize: stats.size,
							}
						)
					);
				}
			});
		});
	}
}

function nodeStreamToReadableStream(stream: any): ReadableStream {
	const readableStream = new ReadableStream({
		start(controller) {
			stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
			stream.on('end', () => controller.close());
		},
	});
	return readableStream;
}
