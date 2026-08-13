import { encodeStringAsBase64 } from './base64';

export function phpVar(value: unknown): string {
	return `json_decode(base64_decode('${encodeStringAsBase64(
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
