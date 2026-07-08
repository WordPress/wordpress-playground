import type { WritableFilesystemBackend } from '@wp-playground/storage';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';

export async function writeBlueprintJsonToFilesystemBackend(
	originalBlueprint: SiteInfo['metadata']['originalBlueprint'],
	blueprintJson: string
): Promise<boolean> {
	if (!isFilesystemBackend(originalBlueprint)) {
		return false;
	}
	await originalBlueprint.writeFile(
		'/blueprint.json',
		new TextEncoder().encode(blueprintJson)
	);
	return true;
}

export function isFilesystemBackend(
	obj: unknown
): obj is WritableFilesystemBackend {
	if (typeof obj !== 'object' || obj === null) {
		return false;
	}

	const methods = [
		'listFiles',
		'isDir',
		'read',
		'fileExists',
		'writeFile',
		'mkdir',
		'rmdir',
		'mv',
		'unlink',
		'clear',
	];
	return methods.every(
		(method) =>
			typeof (obj as Record<string, unknown>)[method] === 'function'
	);
}
