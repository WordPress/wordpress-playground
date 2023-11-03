const literal = Symbol('literal');

export function phpVar(value: unknown): string {
	if (typeof value === 'string') {
		const escapedValue = JSON.stringify(value)
			.replace(/\\/g, '\\\\')
			.replace(/'/g, "\\'");
		return `json_decode('${escapedValue}')`;
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
