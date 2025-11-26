import type { AsyncWritableFilesystem } from '@wp-playground/components';
import { type Blueprint, BlueprintReflection } from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { WritableInMemoryBundle } from './writable-in-memory-bundle';
import { WritableOpfsBundle } from './writable-opfs-bundle';
import { normalizePath } from '@php-wasm/util';

/**
 * Convert a Blueprint (declaration or bundle) into a writable in-memory filesystem,
 * pre-populated with blueprint.json and all bundled resources.
 */
export async function convertBlueprintToWritableFilesystem(
	blueprint: Blueprint,
	onChange?: (bundle: WritableInMemoryBundle) => void
): Promise<AsyncWritableFilesystem> {
	// If the hash indicates a previously edited local bundle, try to load it first.
	if (
		typeof window !== 'undefined' &&
		window.location.hash === '#local-blueprint-bundle'
	) {
		try {
			const loaded = await WritableOpfsBundle.loadFromOpfs(onChange);
			return loaded;
		} catch {
			// Fall through to fresh construction.
		}
	}

	const reflection = await BlueprintReflection.create(blueprint);
	const declaration = reflection.getDeclaration();
	const bundle = reflection.getBundle();

	const files: Record<string, Uint8Array | string> = {};
	files['/blueprint.json'] = JSON.stringify(declaration, null, 2);

	const bundledPaths = Array.from(collectBundledResourcePaths(declaration));
	for (const path of bundledPaths) {
		const normalized = ensureAbsolutePath(path);
		let content: Uint8Array | string =
			'/* Bundled resource not found in this bundle. */';
		if (bundle) {
			try {
				const file = await bundle.read(normalized.replace(/^\//, ''));
				content = new Uint8Array(await file.arrayBuffer());
			} catch (error) {
				logger.debug(
					`Could not read bundled resource at ${normalized}`,
					error
				);
			}
		}
		files[normalized] = content;
	}

	try {
		return await WritableOpfsBundle.create(files, onChange);
	} catch {
		return new WritableInMemoryBundle(files, onChange);
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
export function ensureAbsolutePath(path: string): string {
	let normalized = normalizePath(path || '/');
	if (!normalized || normalized === '.') {
		normalized = '/';
	}
	if (!normalized.startsWith('/')) {
		normalized = `/${normalized}`;
	}
	if (normalized === '//') {
		return '/';
	}
	return normalized;
}
