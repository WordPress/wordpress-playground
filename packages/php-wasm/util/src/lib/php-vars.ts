export function phpVar(value: unknown): string {
	return `json_decode(base64_decode('${stringToBase64(
		JSON.stringify(value)
	)}'), true)`;
}

export function phpVars<T extends Record<string, unknown>>(
	vars: T
): Record<keyof T, string> {
	const result: Record<string, string> = {};
	for (const key in vars) {
		result[key] = phpVar(vars[key]);
	}
	return result as Record<keyof T, string>;
}

function stringToBase64(str: string) {
	return bytesToBase64(new TextEncoder().encode(str));
}

function bytesToBase64(bytes: Uint8Array) {
	const binString = String.fromCodePoint(...bytes);
	return btoa(binString);
}
