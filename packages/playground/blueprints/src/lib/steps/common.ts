import type { PHPResponse, UniversalPHP } from '@php-wasm/universal';

export function asDOM(response: PHPResponse) {
	return new DOMParser().parseFromString(response.text, 'text/html')!;
}

export function zipNameToHumanName(zipName: string) {
	const mixedCaseName = zipName.split('.').shift()!.replace('-', ' ');
	return (
		mixedCaseName.charAt(0).toUpperCase() +
		mixedCaseName.slice(1).toLowerCase()
	);
}

type PatchFileCallback = (contents: string) => string | Uint8Array;
export async function updateFile(
	php: UniversalPHP,
	path: string,
	callback: PatchFileCallback
) {
	let contents = '';
	if (await php.fileExists(path)) {
		contents = await php.readFileAsText(path);
	}
	await php.writeFile(path, callback(contents));
}

export async function fileToUint8Array(file: File) {
	return new Uint8Array(await file.arrayBuffer());
}

export const VFS_CONFIG_FILE_BASENAME = '/vfs-blueprints';
