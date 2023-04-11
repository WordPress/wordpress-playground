import type { PHPResponse } from '@php-wasm/web';

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
