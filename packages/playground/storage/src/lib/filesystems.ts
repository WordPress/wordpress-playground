import { StreamedFile } from '@php-wasm/stream-compression';
import type { FileTree } from '@php-wasm/universal';
import { joinPaths, normalizePath } from '@php-wasm/util';
import type { Entry } from '@zip.js/zip.js';
import { ZipReader, BlobWriter, BlobReader } from '@zip.js/zip.js';

export interface ReadableFilesystemBackend {
	read(path: string): Promise<StreamedFile>;
}

/**
 * A readable filesystem that can also be traversed (list directories).
 */
export interface TraversableFilesystemBackend extends ReadableFilesystemBackend {
	listFiles(path: string): Promise<string[]>;
	isDir(path: string): Promise<boolean>;
}

/**
 * Backend interface for writable filesystem operations.
 * All paths passed to these methods are expected to be absolute paths.
 */
export interface WritableFilesystemBackend extends TraversableFilesystemBackend {
	fileExists(absolutePath: string): Promise<boolean>;
	writeFile(absolutePath: string, data: Uint8Array): Promise<void>;
	mkdir(absolutePath: string, recursive?: boolean): Promise<void>;
	rmdir(absolutePath: string, recursive: boolean): Promise<void>;
	mv(absoluteSource: string, absoluteDestination: string): Promise<void>;
	unlink(absolutePath: string): Promise<void>;
	clear(): Promise<void>;
}

/**
 * Interface for a writable filesystem with EventTarget support.
 * Used by UI components that need to react to filesystem changes.
 */
export interface AsyncWritableFilesystem extends EventTarget {
	isDir(path: string): Promise<boolean>;
	fileExists(path: string): Promise<boolean>;
	read(path: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
	readFileAsText(path: string): Promise<string>;
	listFiles(path: string): Promise<string[]>;
	writeFile(path: string, data: Uint8Array | string): Promise<void>;
	mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
	rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
	mv(source: string, destination: string): Promise<void>;
	unlink(path: string): Promise<void>;
}

/**
 * Copy all files from source filesystem to destination filesystem.
 * Clears the destination before copying.
 */
export async function copyFilesystem(
	source: TraversableFilesystemBackend,
	destination: WritableFilesystemBackend
): Promise<void> {
	await destination.clear();

	const copyDir = async (path: string) => {
		const entries = await source.listFiles(path);
		for (const name of entries) {
			const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
			if (await source.isDir(fullPath)) {
				await destination.mkdir(fullPath);
				await copyDir(fullPath);
			} else {
				const file = await source.read(fullPath);
				const content = new Uint8Array(await file.arrayBuffer());
				await destination.writeFile(fullPath, content);
			}
		}
	};

	await copyDir('/');
}

/**
 * Wraps a WritableFilesystemBackend with EventTarget support and convenience methods.
 * Dispatches 'change' events on write operations.
 */
export class EventedFilesystem
	extends EventTarget
	implements AsyncWritableFilesystem
{
	private readonly encoder = new TextEncoder();
	private readonly decoder = new TextDecoder();
	readonly backend: WritableFilesystemBackend;

	constructor(backend: WritableFilesystemBackend) {
		super();
		this.backend = backend;
	}

	async isDir(path: string): Promise<boolean> {
		return this.backend.isDir(path);
	}

	async fileExists(path: string): Promise<boolean> {
		return this.backend.fileExists(path);
	}

	async read(path: string): Promise<StreamedFile> {
		return this.backend.read(path);
	}

	async readFileAsText(path: string): Promise<string> {
		const file = await this.read(path);
		const buffer = await file.arrayBuffer();
		return this.decoder.decode(buffer);
	}

	async listFiles(path: string): Promise<string[]> {
		return this.backend.listFiles(path);
	}

	async writeFile(path: string, data: Uint8Array | string): Promise<void> {
		const content =
			typeof data === 'string' ? this.encoder.encode(data) : data;
		await this.backend.writeFile(path, content);
		this.dispatchEvent(new Event('change'));
	}

	async mkdir(
		path: string,
		options?: { recursive?: boolean }
	): Promise<void> {
		await this.backend.mkdir(path, options?.recursive ?? false);
		this.dispatchEvent(new Event('change'));
	}

	async rmdir(
		path: string,
		options?: { recursive?: boolean }
	): Promise<void> {
		await this.backend.rmdir(path, options?.recursive ?? false);
		this.dispatchEvent(new Event('change'));
	}

	async mv(source: string, destination: string): Promise<void> {
		if (source === destination) {
			return;
		}
		await this.backend.mv(source, destination);
		this.dispatchEvent(new Event('change'));
	}

	async unlink(path: string): Promise<void> {
		await this.backend.unlink(path);
		this.dispatchEvent(new Event('change'));
	}

	async clear(): Promise<void> {
		await this.backend.clear();
		this.dispatchEvent(new Event('change'));
	}
}

export class InMemoryFilesystem implements ReadableFilesystemBackend {
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

export class ZipFilesystem implements ReadableFilesystemBackend {
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
		const normalized = normalizePath(relativePath).replace(/^\//, '');
		const entry = entries.get(normalized);
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

	/**
	 * Returns the paths of all entries in the zip (file and directory names).
	 */
	async getAllFilePaths(): Promise<string[]> {
		const entries = await this.getEntries();
		return Array.from(entries.keys());
	}
}

/**
 * A ReadableFilesystemBackend that exposes a subdirectory of another backend
 * as the root, similar to chroot. Paths are resolved via joinPaths.
 */
export class ChrootFilesystem implements ReadableFilesystemBackend {
	private readonly chroot: string;
	private readonly backend: ReadableFilesystemBackend;

	constructor(chroot: string, backend: ReadableFilesystemBackend) {
		this.chroot = chroot;
		this.backend = backend;
	}

	async read(path: string): Promise<StreamedFile> {
		const chrootedPath = joinPaths(this.chroot, path);
		return this.backend.read(chrootedPath);
	}
}

/**
 * A Filesystem implementation that cascades through multiple filesystems
 * and returns the first successful result.
 *
 * This is useful for creating a layered approach to file resolution,
 * such as checking a local cache before fetching from a remote source.
 */
export class OverlayFilesystem implements ReadableFilesystemBackend {
	private filesystems: ReadableFilesystemBackend[];

	/**
	 * Creates a new OverlayFilesystem.
	 *
	 * @param filesystems An array of Filesystem instances to cascade through.
	 *                    The order determines the priority - earlier filesystems
	 *                    are checked first.
	 */
	constructor(filesystems: ReadableFilesystemBackend[]) {
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
export class FetchFilesystem implements ReadableFilesystemBackend {
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
export class NodeJsFilesystem implements ReadableFilesystemBackend {
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

/**
 * OPFS filesystem backend that operates directly on the Origin Private File System.
 * Implements both ReadableFilesystemBackend (for BlueprintBundle) and
 * WritableFilesystemBackend (for the editor).
 */
export class OpfsFilesystemBackend implements WritableFilesystemBackend {
	private readonly opfsRoot: FileSystemDirectoryHandle;

	constructor(opfsRoot: FileSystemDirectoryHandle) {
		this.opfsRoot = opfsRoot;
	}

	/**
	 * Create a backend for a specific OPFS directory handle.
	 */
	static fromDirectoryHandle(
		handle: FileSystemDirectoryHandle
	): OpfsFilesystemBackend {
		return new OpfsFilesystemBackend(handle);
	}

	/**
	 * Create a backend for a specific path in OPFS.
	 * The path will be created if `create` is true.
	 * @throws Error if OPFS is not available or path doesn't exist (when create=false)
	 */
	static async fromPath(
		path: string,
		create = false
	): Promise<OpfsFilesystemBackend> {
		if (typeof navigator === 'undefined') {
			throw new Error('OPFS not available: navigator is undefined');
		}
		if (!navigator.storage || !navigator.storage.getDirectory) {
			throw new Error('OPFS not available: storage API not supported');
		}
		let handle = await navigator.storage.getDirectory();
		const segments = path.split('/').filter(Boolean);
		for (const segment of segments) {
			handle = await handle.getDirectoryHandle(segment, { create });
		}
		return new OpfsFilesystemBackend(handle);
	}

	async clear(): Promise<void> {
		for await (const [name] of this.opfsRoot.entries()) {
			try {
				await this.opfsRoot.removeEntry(name, { recursive: true });
			} catch {
				/* ignore */
			}
		}
	}

	// ReadableFilesystemBackend interface
	async read(path: string): Promise<StreamedFile> {
		const content = await this.readFileAsBuffer(path);
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

	async isDir(absolutePath: string): Promise<boolean> {
		if (absolutePath === '/') {
			return true;
		}
		try {
			const segments = absolutePath.split('/').filter(Boolean);
			let dir = this.opfsRoot;
			for (const segment of segments) {
				dir = await dir.getDirectoryHandle(segment);
			}
			return true;
		} catch {
			return false;
		}
	}

	async fileExists(absolutePath: string): Promise<boolean> {
		const segments = absolutePath.split('/').filter(Boolean);
		// Root always exists
		if (segments.length === 0) {
			return true;
		}
		const name = segments.pop()!;
		try {
			let dir = this.opfsRoot;
			for (const segment of segments) {
				dir = await dir.getDirectoryHandle(segment);
			}
			// Check if it's a file or directory
			try {
				await dir.getFileHandle(name);
				return true;
			} catch {
				await dir.getDirectoryHandle(name);
				return true;
			}
		} catch {
			return false;
		}
	}

	async listFiles(absolutePath: string): Promise<string[]> {
		let dir = this.opfsRoot;
		if (absolutePath !== '/') {
			const segments = absolutePath.split('/').filter(Boolean);
			for (const segment of segments) {
				dir = await dir.getDirectoryHandle(segment);
			}
		}
		const names: string[] = [];
		for await (const [name] of dir.entries()) {
			names.push(name);
		}
		return names;
	}

	async writeFile(absolutePath: string, data: Uint8Array): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		const fileName = segments.pop();
		if (!fileName) {
			throw new Error(`Invalid file path: ${absolutePath}`);
		}
		// Navigate to parent directory without creating it
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}
		const handle = await dir.getFileHandle(fileName, { create: true });
		const writable = await handle.createWritable();
		await writable.write(data);
		await writable.close();
	}

	async mkdir(absolutePath: string, recursive = false): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		let dir = this.opfsRoot;
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const isLast = i === segments.length - 1;
			// Only create the final directory; parent dirs must exist unless recursive
			dir = await dir.getDirectoryHandle(segment, {
				create: recursive || isLast,
			});
		}
	}

	async rmdir(absolutePath: string, recursive: boolean): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		const name = segments.pop();
		if (!name) {
			return;
		}
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}
		await dir.removeEntry(name, { recursive });
	}

	async mv(
		absoluteSource: string,
		absoluteDestination: string
	): Promise<void> {
		const isSourceDir = await this.isDir(absoluteSource);
		if (isSourceDir) {
			await this.copyDir(absoluteSource, absoluteDestination);
			await this.rmdir(absoluteSource, true);
		} else {
			const content = await this.readFileAsBuffer(absoluteSource);
			await this.writeFile(absoluteDestination, content);
			await this.unlink(absoluteSource);
		}
	}

	async unlink(absolutePath: string): Promise<void> {
		const segments = absolutePath.split('/').filter(Boolean);
		const name = segments.pop();
		if (!name) {
			return;
		}
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}
		try {
			await dir.removeEntry(name);
		} catch {
			/* ignore */
		}
	}

	// --- Internal helpers ---
	private async readFileAsBuffer(absolutePath: string): Promise<Uint8Array> {
		const segments = absolutePath.split('/').filter(Boolean);
		const fileName = segments.pop();
		if (!fileName) {
			throw new Error(`Invalid file path: ${absolutePath}`);
		}
		let dir = this.opfsRoot;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment);
		}
		const handle = await dir.getFileHandle(fileName);
		const file = await handle.getFile();
		return new Uint8Array(await file.arrayBuffer());
	}

	private async copyDir(source: string, destination: string): Promise<void> {
		await this.mkdir(destination);
		const files = await this.listFiles(source);
		for (const name of files) {
			const srcPath = source === '/' ? `/${name}` : `${source}/${name}`;
			const destPath =
				destination === '/' ? `/${name}` : `${destination}/${name}`;
			if (await this.isDir(srcPath)) {
				await this.copyDir(srcPath, destPath);
			} else {
				const content = await this.readFileAsBuffer(srcPath);
				await this.writeFile(destPath, content);
			}
		}
	}
}

type FileNode = { type: 'file'; content: Uint8Array };
type DirNode = { type: 'dir'; children: Record<string, FsNode> };
type FsNode = FileNode | DirNode;

/**
 * In-memory writable filesystem backend that stores files in a tree structure.
 */
export class InMemoryFilesystemBackend implements WritableFilesystemBackend {
	private root: DirNode = { type: 'dir', children: {} };

	constructor(initialFiles: Record<string, Uint8Array> = {}) {
		for (const [path, content] of Object.entries(initialFiles)) {
			this.writeFileSync(path, content);
		}
	}

	async read(path: string): Promise<StreamedFile> {
		const file = this.getFile(path);
		const content = file.content;
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

	async isDir(absolutePath: string): Promise<boolean> {
		const node = this.getNode(absolutePath);
		return !!node && node.type === 'dir';
	}

	async fileExists(absolutePath: string): Promise<boolean> {
		const node = this.getNode(absolutePath);
		return !!node;
	}

	async listFiles(absolutePath: string): Promise<string[]> {
		const node = this.getNode(absolutePath);
		if (!node || node.type !== 'dir') {
			return [];
		}
		return Object.keys(node.children);
	}

	async writeFile(absolutePath: string, data: Uint8Array): Promise<void> {
		this.writeFileSync(absolutePath, data);
	}

	async mkdir(absolutePath: string, recursive = false): Promise<void> {
		// Root always exists, nothing to create
		if (absolutePath === '/') {
			return;
		}
		const { parent, name } = recursive
			? this.getOrCreateParent(absolutePath)
			: this.getParent(absolutePath);
		if (!parent.children[name]) {
			parent.children[name] = { type: 'dir', children: {} };
		}
	}

	async rmdir(absolutePath: string, recursive: boolean): Promise<void> {
		const { parent, name } = this.getParent(absolutePath);
		const target = parent.children[name];
		if (!target || target.type !== 'dir') {
			return;
		}
		if (!recursive && Object.keys(target.children).length > 0) {
			throw new Error('Directory not empty');
		}
		delete parent.children[name];
	}

	async mv(
		absoluteSource: string,
		absoluteDestination: string
	): Promise<void> {
		const { parent: sourceParent, name: sourceName } =
			this.getParent(absoluteSource);
		const entry = sourceParent.children[sourceName];
		if (!entry) {
			throw new Error(`Source not found: ${absoluteSource}`);
		}

		const { parent: destParent, name: destName } =
			this.getParent(absoluteDestination);
		destParent.children[destName] = entry;
		delete sourceParent.children[sourceName];
	}

	async unlink(absolutePath: string): Promise<void> {
		const { parent, name } = this.getParent(absolutePath);
		const target = parent.children[name];
		if (target && target.type === 'file') {
			delete parent.children[name];
		}
	}

	async clear(): Promise<void> {
		this.root = { type: 'dir', children: {} };
	}

	// --- Internal helpers ---
	private writeFileSync(absolutePath: string, data: Uint8Array): void {
		const { parent, name } = this.getParent(absolutePath);
		parent.children[name] = {
			type: 'file',
			content: new Uint8Array(data),
		};
	}

	private getNode(absolutePath: string): FsNode | undefined {
		if (absolutePath === '/') {
			return this.root;
		}
		const parts = absolutePath.split('/').filter(Boolean);
		let current: FsNode = this.root;
		for (const segment of parts) {
			if (current.type !== 'dir') {
				return undefined;
			}
			const next = current.children[segment] as FsNode | undefined;
			if (!next) {
				return undefined;
			}
			current = next;
		}
		return current;
	}

	private getDir(absolutePath: string): DirNode {
		const node = this.getNode(absolutePath);
		if (!node || node.type !== 'dir') {
			throw new Error(`Directory not found: ${absolutePath}`);
		}
		return node;
	}

	private getFile(absolutePath: string): FileNode {
		const node = this.getNode(absolutePath);
		if (!node || node.type !== 'file') {
			throw new Error(`File not found: ${absolutePath}`);
		}
		return node;
	}

	/**
	 * Get parent directory, throwing if it doesn't exist.
	 */
	private getParent(absolutePath: string): { parent: DirNode; name: string } {
		const segments = absolutePath.split('/').filter(Boolean);
		const name = segments.pop();
		if (!name) {
			throw new Error(`Invalid path: ${absolutePath}`);
		}
		const parentPath = segments.length ? `/${segments.join('/')}` : '/';
		const parent = this.getNode(parentPath);
		if (!parent || parent.type !== 'dir') {
			throw new Error(`Parent directory not found: ${parentPath}`);
		}
		return { parent, name };
	}

	/**
	 * Get parent directory, creating it if it doesn't exist.
	 */
	private getOrCreateParent(absolutePath: string): {
		parent: DirNode;
		name: string;
	} {
		const segments = absolutePath.split('/').filter(Boolean);
		const name = segments.pop();
		if (!name) {
			throw new Error(`Invalid path: ${absolutePath}`);
		}
		const parentPath = segments.length ? `/${segments.join('/')}` : '/';
		const parent = this.ensureDir(parentPath);
		return { parent, name };
	}

	private ensureDir(absolutePath: string): DirNode {
		if (absolutePath === '/') {
			return this.root;
		}
		const parts = absolutePath.split('/').filter(Boolean);
		let current: DirNode = this.root;
		for (const part of parts) {
			const next = current.children[part];
			if (!next) {
				const dir: DirNode = { type: 'dir', children: {} };
				current.children[part] = dir;
				current = dir;
				continue;
			}
			if (next.type !== 'dir') {
				throw new Error(
					`Path segment "${part}" is not a directory in ${absolutePath}`
				);
			}
			current = next;
		}
		return current;
	}
}
