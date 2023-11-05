const literal = Symbol('literal');

export function phpVar(value: unknown): string {
	if (typeof value === 'string') {
		return `base64_decode('${stringToBase64(value)}')`;
	} else if (typeof value === 'number') {
		return value.toString();
	} else if (Array.isArray(value)) {
		const phpArray = value.map(phpVar).join(', ');
		return `array(${phpArray})`;
	} else if (value === null) {
		return 'null';
	} else if (typeof value === 'object') {
		if (literal in value) {
			return value.toString();
		} else {
			const phpAssocArray = Object.entries(value)
				.map(([key, val]) => `${phpVar(key)} => ${phpVar(val)}`)
				.join(', ');
			return `array(${phpAssocArray})`;
		}
	} else if (typeof value === 'function') {
		return value();
	} else if (ArrayBuffer.isView(value)) {
		return `base64_decode("'${bytesToBase64(
			new Uint8Array(value as any)
		)}'")`;
	}
	throw new Error(`Unsupported value: ${value}`);
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
