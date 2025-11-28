import type { AsyncWritableFilesystem } from '@wp-playground/components';
import {
	type Blueprint,
	type BlueprintBundle,
	BlueprintReflection,
} from '@wp-playground/blueprints';
import { StreamedFile } from '@php-wasm/stream-compression';
import { dirname, ensureAbsolutePath } from '@php-wasm/util';

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
	clear(): Promise<void>;
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

	async clear(): Promise<void> {
		await this.backend.clear();
		this.dispatchEvent(new Event('change'));
	}

	/**
	 * Populate the filesystem with the contents of a Blueprint.
	 * Writes blueprint.json and all bundled resources.
	 */
	async populateFromBlueprint(blueprint: Blueprint): Promise<void> {
		const reflection = await BlueprintReflection.create(blueprint);
		const declaration = reflection.getDeclaration();
		const bundle = reflection.getBundle();

		await this.writeFile(
			'/blueprint.json',
			JSON.stringify(declaration, null, 2)
		);

		if (bundle) {
			for (const path of collectBundledResourcePaths(declaration)) {
				const absolutePath = ensureAbsolutePath(path);
				// For each path referenced in the blueprint, try to read the
				// accompanying file from the bundle. Some files might be missing,
				// this is fine – we'll just skip them here.
				let content: Uint8Array | string = '';
				try {
					const file = await bundle.read(absolutePath);
					content = new Uint8Array(await file.arrayBuffer());
				} catch {
					continue;
				}
				const parent = dirname(absolutePath);
				if (!(await this.fileExists(parent))) {
					await this.mkdir(parent);
				}
				await this.writeFile(absolutePath, content);
			}
		}
	}
}

function collectBundledResourcePaths(value: unknown): Set<string> {
	const accumulator = new Set<string>();
	const stack: unknown[] = [value];
	while (stack.length) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}

		if (Array.isArray(current)) {
			for (const item of current) {
				stack.push(item);
			}
			continue;
		}

		const candidate = current as { resource?: unknown; path?: unknown };
		if (
			candidate.resource === 'bundled' &&
			typeof candidate.path === 'string'
		) {
			accumulator.add(ensureAbsolutePath(candidate.path));
		}

		for (const child of Object.values(current)) {
			stack.push(child);
		}
	}

	return accumulator;
}
