import type { AsyncWritableFilesystem } from '@wp-playground/components';
import { type Blueprint, BlueprintReflection } from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import {
	collectBundledResourcePaths,
	ensureAbsolutePath,
} from './bundle-utils';
import { WritableInMemoryBundle } from './writable-in-memory-bundle';

/**
 * Convert a Blueprint (declaration or bundle) into a writable in-memory filesystem,
 * pre-populated with blueprint.json and all bundled resources.
 */
export async function convertBlueprintToWritableFilesystem(
	blueprint: Blueprint,
	onChange?: (bundle: WritableInMemoryBundle) => void
): Promise<AsyncWritableFilesystem> {
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

	return new WritableInMemoryBundle(files, onChange);
}
