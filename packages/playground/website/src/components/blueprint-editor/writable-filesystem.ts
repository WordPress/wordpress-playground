import type { AsyncWritableFilesystem } from '@wp-playground/components';
import type { BlueprintBundle } from '@wp-playground/blueprints';
import { StreamedFile } from '@php-wasm/stream-compression';
import { ensureAbsolutePath } from '@php-wasm/util';

/**
 * Backend interface for filesystem operations.
 * All paths passed to these methods are already normalized to absolute paths.
 */
export interface FilesystemBackend {
	isDir(absolutePath: string): Promise<boolean>;
	fileExists(absolutePath: string): Promise<boolean>;
	readFileAsBuffer(absolutePath: string): Promise<Uint8Array>;
	listFiles(absolutePath: string): Promise<string[]>;
	writeFile(absolutePath: string, data: Uint8Array): Promise<void>;
	mkdir(absolutePath: string): Promise<void>;
	rmdir(absolutePath: string, recursive: boolean): Promise<void>;
	mv(absoluteSource: string, absoluteDestination: string): Promise<void>;
	unlink(absolutePath: string): Promise<void>;
}

/**
 * Writable filesystem that delegates to a backend implementation.
 * Handles path normalization, event dispatching, and type conversions.
 */
export class WritableFilesystem
	extends EventTarget
	implements AsyncWritableFilesystem, BlueprintBundle
{
	private readonly encoder = new TextEncoder();
	private readonly decoder = new TextDecoder();

	constructor(private readonly backend: FilesystemBackend) {
		super();
	}

	async isDir(path: string): Promise<boolean> {
		return this.backend.isDir(ensureAbsolutePath(path));
	}

	async fileExists(path: string): Promise<boolean> {
		return this.backend.fileExists(ensureAbsolutePath(path));
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		return this.backend.readFileAsBuffer(ensureAbsolutePath(path));
	}

	async readFileAsText(path: string): Promise<string> {
		return this.decoder.decode(await this.readFileAsBuffer(path));
	}

	async listFiles(path: string): Promise<string[]> {
		return this.backend.listFiles(ensureAbsolutePath(path));
	}

	async writeFile(path: string, data: Uint8Array | string): Promise<void> {
		const absolutePath = ensureAbsolutePath(path);
		const content =
			typeof data === 'string' ? this.encoder.encode(data) : data;
		await this.backend.writeFile(absolutePath, content);
		this.dispatchEvent(new Event('change'));
	}

	async mkdir(path: string): Promise<void> {
		await this.backend.mkdir(ensureAbsolutePath(path));
		this.dispatchEvent(new Event('change'));
	}

	async rmdir(
		path: string,
		options?: { recursive?: boolean }
	): Promise<void> {
		await this.backend.rmdir(
			ensureAbsolutePath(path),
			options?.recursive ?? false
		);
		this.dispatchEvent(new Event('change'));
	}

	async mv(source: string, destination: string): Promise<void> {
		const absoluteSource = ensureAbsolutePath(source);
		const absoluteDestination = ensureAbsolutePath(destination);
		if (absoluteSource === absoluteDestination) {
			return;
		}
		await this.backend.mv(absoluteSource, absoluteDestination);
		this.dispatchEvent(new Event('change'));
	}

	async unlink(path: string): Promise<void> {
		await this.backend.unlink(ensureAbsolutePath(path));
		this.dispatchEvent(new Event('change'));
	}

	// --- BlueprintBundle method ---
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
}
