import type { AsyncWritableFilesystem } from '@wp-playground/components';
import { type Blueprint, BlueprintReflection } from '@wp-playground/blueprints';
import { WritableInMemoryFilesystem } from './writable-in-memory-filesystem';
import { WritableOpfsFilesystem } from './writable-opfs-filesystem';
import { dirname, ensureAbsolutePath } from '@php-wasm/util';

/**
 * Convert a Blueprint (declaration or bundle) into a writable in-memory filesystem,
 * pre-populated with blueprint.json and all bundled resources.
 */
type ConvertOptions = {
	persistToOpfs?: boolean;
};

export async function convertBlueprintToWritableFilesystem(
	blueprint: Blueprint,
	options: ConvertOptions = {}
): Promise<AsyncWritableFilesystem> {
	const shouldPersist = options.persistToOpfs ?? true;
	// If the hash indicates a previously edited local bundle, try to load it first.
	// @TODO: Do not reason about the URL hash here.
	if (
		typeof window !== 'undefined' &&
		window.location.hash === '#local-blueprint-bundle' &&
		(await WritableOpfsFilesystem.hasSavedBundle())
	) {
		return await WritableOpfsFilesystem.loadFromOpfs();
	}

	let fs: AsyncWritableFilesystem | undefined = undefined;
	if (shouldPersist) {
		try {
			fs = await WritableOpfsFilesystem.create();
		} catch {
			// Fall through to in-memory fallback.
		}
	}
	if (!fs) {
		fs = new WritableInMemoryFilesystem();
	}

	const reflection = await BlueprintReflection.create(blueprint);
	const declaration = reflection.getDeclaration();
	const bundle = reflection.getBundle();

	await fs.writeFile('/blueprint.json', JSON.stringify(declaration, null, 2));

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
			if (!(await fs.fileExists(parent))) {
				await fs.mkdir(parent);
			}
			await fs.writeFile(absolutePath, content);
		}
	}

	return fs;
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
