import {
	FetchFilesystem,
	InMemoryFilesystem,
	OverlayFilesystem,
	ZipFilesystem,
} from '@wp-playground/storage';
import type { BlueprintBundle } from './v1/types';

/**
 * Resolves a remote blueprint from a URL.
 *
 * @param url - The URL of the blueprint to resolve.
 * @returns A promise that resolves to the resolved blueprint.
 */
export async function resolveRemoteBlueprint(
	url: string
): Promise<BlueprintBundle> {
	const response = await fetch(url, {
		credentials: 'omit',
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch blueprint from ${url}`);
	}
	const blueprintBytes = await response.arrayBuffer();
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
	} catch {
		// If the blueprint is not a JSON file, check if it's a ZIP file.
		if (await looksLikeZipFile(blueprintBytes)) {
			return ZipFilesystem.fromArrayBuffer(blueprintBytes);
		}
		throw new Error(
			`Blueprint file at ${url} is neither a valid JSON nor a ZIP file.`
		);
	}
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
