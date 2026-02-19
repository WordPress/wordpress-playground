import {
	FetchFilesystem,
	InMemoryFilesystem,
	OverlayFilesystem,
	ChrootFilesystem,
	ZipFilesystem,
} from '@wp-playground/storage';
import type { BlueprintBundle } from './types';

export class BlueprintFetchError extends Error {
	public readonly url: string;

	constructor(message: string, url: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'BlueprintFetchError';
		this.url = url;
	}
}

/**
 * Resolves a remote blueprint from a URL.
 *
 * @param url - The URL of the blueprint to resolve.
 * @returns A promise that resolves to the resolved blueprint.
 */
export async function resolveRemoteBlueprint(
	url: string
): Promise<BlueprintBundle> {
	let blueprintBytes: ArrayBuffer;
	try {
		const response = await fetch(url, {
			credentials: 'omit',
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch blueprint from ${url}`);
		}
		blueprintBytes = await response.arrayBuffer();
	} catch (error) {
		throw new BlueprintFetchError(
			`Blueprint file could not be resolved from ${url}: ${error instanceof Error ? error.message : String(error)}`,
			url,
			{ cause: error }
		);
	}

	try {
		const blueprintText = new TextDecoder().decode(blueprintBytes);
		JSON.parse(blueprintText);

		// No exceptions, good! We're dealing with a JSON file. Let's
		// resolve the "bundled" resources from the same remote URL.
		return new OverlayFilesystem([
			new InMemoryFilesystem({
				'blueprint.json': blueprintText,
			}),
			new FetchFilesystem({
				baseUrl: url,
			}),
		]);
	} catch (error) {
		// If the blueprint is not a JSON file, check if it's a ZIP file.
		if (await looksLikeZipFile(blueprintBytes)) {
			return createBlueprintBundleFromZip(blueprintBytes);
		}
		throw new Error(
			`Blueprint file at ${url} is neither a valid JSON nor a ZIP file.`,
			{ cause: error }
		);
	}
}

/**
 * Finds blueprint.json in zip entry paths: at root or inside a directory.
 * Prefers root blueprint.json when both exist.
 * @returns The path to blueprint.json (e.g. "blueprint.json" or "my-dir/blueprint.json"), or null.
 */
function findBlueprintJsonPath(entryPaths: string[]): string | null {
	const normalized = entryPaths.map((p) => p.replace(/\\/g, '/').replace(/\/$/, ''));
	// Prefer root blueprint.json
	if (normalized.includes('blueprint.json')) {
		return 'blueprint.json';
	}
	for (const path of normalized) {
		if (path.endsWith('/blueprint.json')) {
			return path;
		}
	}
	return null;
}

/**
 * Creates a BlueprintBundle from a zip ArrayBuffer. Looks for blueprint.json
 * at the root or inside any directory so both flat and nested zip layouts work.
 */
async function createBlueprintBundleFromZip(
	arrayBuffer: ArrayBuffer
): Promise<BlueprintBundle> {
	const zipFs = ZipFilesystem.fromArrayBuffer(arrayBuffer);
	const entryPaths = await zipFs.getAllFilePaths();
	const blueprintPath = findBlueprintJsonPath(entryPaths);
	if (!blueprintPath) {
		throw new Error(
			'ZIP file does not contain blueprint.json at root or inside a directory.'
		);
	}
	const prefix =
		blueprintPath === 'blueprint.json'
			? ''
			: blueprintPath.replace(/\/blueprint\.json$/, '/');
	return prefix === '' ? zipFs : new ChrootFilesystem(prefix, zipFs);
}

async function looksLikeZipFile(bytes: ArrayBuffer): Promise<boolean> {
	if (bytes.byteLength < 4) {
		return false;
	}
	const filePrefix = new Uint8Array(bytes, 0, 4);
	// Check against the signature for non-empty, non-spanned zip files.
	const matchesZipSignature =
		filePrefix[0] === 0x50 &&
		filePrefix[1] === 0x4b &&
		filePrefix[2] === 0x03 &&
		filePrefix[3] === 0x04;
	return matchesZipSignature;
}
