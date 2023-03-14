import { PHPResponse } from "@wordpress/php-wasm";

export function toZipName(rawInput) {
	if (!rawInput) {
		return rawInput;
	}
	if (rawInput.endsWith('.zip')) {
		return rawInput;
	}
	return rawInput + '.latest-stable.zip';
}

export function zipNameToHumanName(zipName) {
	const mixedCaseName = zipName.split('.').shift()!.replace('-', ' ');
	return (
		mixedCaseName.charAt(0).toUpperCase() +
		mixedCaseName.slice(1).toLowerCase()
	);
}

export function asDOM(response: PHPResponse) {
	return new DOMParser().parseFromString(
		asText(response),
		'text/html'
	)!;
}

export function asText(response: PHPResponse) {
	return new TextDecoder().decode(response.body);
}
