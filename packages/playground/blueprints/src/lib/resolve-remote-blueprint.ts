import {
	FetchFilesystem,
	InMemoryFilesystem,
	OverlayFilesystem,
	ChrootFilesystem,
	ZipFilesystem,
} from '@wp-playground/storage';
import { basename, dirname, normalizePath } from '@php-wasm/util';
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
 * Locates blueprint.json inside a zip archive.
 *
 * 1. Checks for blueprint.json at the root.
 * 2. If not found, looks for a single top-level directory (ignoring
 *    __MACOSX) and checks for blueprint.json inside it.
 * 3. Throws if there are multiple top-level directories or no
 *    blueprint.json is found.
 */
function findBlueprintJsonPath(entryPaths: string[]): string {
	const normalized = entryPaths.map((p) => normalizePath(p));

	if (normalized.some((p) => basename(p) === 'blueprint.json' && dirname(p) === '')) {
		return 'blueprint.json';
	}

	const topLevelDirs = new Set<string>();
	for (const p of normalized) {
		const dir = p.split('/')[0];
		if (dir && dir !== basename(p)) {
			// Entry is inside a directory — record the top-level dir.
			if (dir !== '__MACOSX') {
				topLevelDirs.add(dir);
			}
		}
	}

	if (topLevelDirs.size > 1) {
		throw new Error(
			'ZIP contains multiple top-level directories. ' +
				'Bundle ZIPs must contain blueprint.json at the root ' +
				'or inside a single top-level directory.'
		);
	}

	if (topLevelDirs.size === 1) {
		const dir = [...topLevelDirs][0];
		const candidate = `${dir}/blueprint.json`;
		if (normalized.includes(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		'ZIP does not contain a blueprint.json. ' +
			'Place blueprint.json at the ZIP root or inside a ' +
			'single top-level directory.'
	);
}

/**
 * Creates a BlueprintBundle from a zip ArrayBuffer. Locates
 * blueprint.json at the root or inside a single top-level directory.
 */
async function createBlueprintBundleFromZip(
	arrayBuffer: ArrayBuffer
): Promise<BlueprintBundle> {
	const zipFs = ZipFilesystem.fromArrayBuffer(arrayBuffer);
	const entryPaths = await zipFs.getAllFilePaths();
	const blueprintPath = findBlueprintJsonPath(entryPaths);
	const dir = dirname(blueprintPath);
	return dir === '' ? zipFs : new ChrootFilesystem(dir, zipFs);
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
