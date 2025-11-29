import type { AsyncWritableFilesystem } from '@wp-playground/components';
import {
	type Blueprint,
	type BlueprintBundle,
	BlueprintReflection,
} from '@wp-playground/blueprints';
import type { WritableFilesystemBackend } from '@wp-playground/storage';
import { StreamedFile } from '@php-wasm/stream-compression';
import { dirname, ensureAbsolutePath } from '@php-wasm/util';

// Re-export for convenience
export type { WritableFilesystemBackend } from '@wp-playground/storage';

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
	private readonly backend: WritableFilesystemBackend;

	constructor(backend: WritableFilesystemBackend) {
		super();
		this.backend = backend;
	}

	async isDir(path: string): Promise<boolean> {
		return this.backend.isDir(ensureAbsolutePath(path));
	}

	async fileExists(path: string): Promise<boolean> {
		return this.backend.fileExists(ensureAbsolutePath(path));
	}

	// --- BlueprintBundle / ReadableFilesystemBackend method ---
	async read(path: string): Promise<StreamedFile> {
		return this.backend.read(ensureAbsolutePath(path));
	}

	async readFileAsText(path: string): Promise<string> {
		const file = await this.read(path);
		const buffer = await file.arrayBuffer();
		return this.decoder.decode(buffer);
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
