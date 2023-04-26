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
	await php.writeFile(path, callback(await php.readFileAsText(path)));
}

export async function fileToUint8Array(file: File) {
	return new Uint8Array(await file.arrayBuffer());
}
