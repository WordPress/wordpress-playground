/**
 * Parse an array of constant name-value pairs into a constants object.
 * Works similarly to parseMountDirArguments - each pair of array elements
 * represents a constant name and its value.
 *
 * Format: --define NAME value
 * Examples:
 *     --define API_KEY secret
 *     --define CON=ST "va=lu=e"
 *
 * @param defines - An array where each pair is [name, value]
 * @returns An object mapping constant names to their string values
 */
export function parseDefineStringArguments(
	defines: string[]
): Record<string, string> {
	if (defines.length % 2 !== 0) {
		throw new Error(
			'Invalid constant definition format. Expected pairs of NAME value'
		);
	}

	const constants: Record<string, string> = {};

	for (let i = 0; i < defines.length; i += 2) {
		const name = defines[i];
		const value = defines[i + 1];

		if (!name || !name.trim()) {
			throw new Error('Constant name cannot be empty');
		}

		constants[name.trim()] = value;
	}

	return constants;
}

/**
 * Parse an array of constant name-value pairs into a boolean constants object.
 * Works similarly to parseMountDirArguments - each pair of array elements
 * represents a constant name and its value.
 *
 * Format: --define-bool NAME value
 * Examples:
 *     --define-bool WP_DEBUG true
 *     --define-bool WP_DEBUG_LOG false
 *
 * @param defines - An array where each pair is [name, value]
 * @returns An object mapping constant names to their boolean values
 */
export function parseDefineBoolArguments(
	defines: string[]
): Record<string, boolean> {
	if (defines.length % 2 !== 0) {
		throw new Error(
			'Invalid boolean constant definition format. Expected pairs of NAME value'
		);
	}

	const constants: Record<string, boolean> = {};

	for (let i = 0; i < defines.length; i += 2) {
		const name = defines[i];
		const value = defines[i + 1].trim().toLowerCase();

		if (!name || !name.trim()) {
			throw new Error('Constant name cannot be empty');
		}

		// Parse boolean value
		if (value === 'true' || value === '1') {
			constants[name.trim()] = true;
		} else if (value === 'false' || value === '0') {
			constants[name.trim()] = false;
		} else {
			throw new Error(
				`Invalid boolean value for constant "${name}": "${value}". Must be "true", "false", "1", or "0".`
			);
		}
	}

	return constants;
}

/**
 * Parse an array of constant name-value pairs into a number constants object.
 * Works similarly to parseMountDirArguments - each pair of array elements
 * represents a constant name and its value.
 *
 * Format: --define-number NAME value
 * Examples:
 *     --define-number LIMIT 100
 *     --define-number RATE 45.67
 *
 * @param defines - An array where each pair is [name, value]
 * @returns An object mapping constant names to their numeric values
 */
export function parseDefineNumberArguments(
	defines: string[]
): Record<string, number> {
	if (defines.length % 2 !== 0) {
		throw new Error(
			'Invalid number constant definition format. Expected pairs of NAME value'
		);
	}

	const constants: Record<string, number> = {};

	for (let i = 0; i < defines.length; i += 2) {
		const name = defines[i];
		const value = defines[i + 1].trim();

		if (!name || !name.trim()) {
			throw new Error('Constant name cannot be empty');
		}

		const numValue = Number(value);
		if (isNaN(numValue)) {
			throw new Error(
				`Invalid number value for constant "${name}": "${value}". Must be a valid number.`
			);
		}

		constants[name.trim()] = numValue;
	}

	return constants;
}

/**
 * Merge constants from multiple typed sources into a single constants object.
 * Validates that no constant name is defined multiple times across different types.
 *
 * @param strings - String constants
 * @param bools - Boolean constants
 * @param numbers - Number constants
 * @returns Merged constants object
 * @throws Error if a constant is defined multiple times
 */
function mergeConstants(
	strings: Record<string, string> = {},
	bools: Record<string, boolean> = {},
	numbers: Record<string, number> = {}
): Record<string, string | number | boolean> {
	const merged: Record<string, string | number | boolean> = {};
	const allNames = new Set<string>();

	// Helper to check for duplicates and add to merged object
	const addConstants = (
		constants: Record<string, string | number | boolean>,
		type: string
	) => {
		for (const name in constants) {
			if (allNames.has(name)) {
				throw new Error(
					`Constant "${name}" is defined multiple times across different --define-${type} flags`
				);
			}
			allNames.add(name);
			merged[name] = constants[name];
		}
	};

	addConstants(strings, 'string');
	addConstants(bools, 'bool');
	addConstants(numbers, 'number');

	return merged;
}

/**
 * Merge all constants from CLI arguments.
 *
 * @param args - CLI arguments
 * @returns Merged constants
 */
export function mergeDefinedConstants(args: {
	define?: Record<string, string>;
	'define-bool'?: Record<string, boolean>;
	'define-number'?: Record<string, number>;
}): Record<string, string | number | boolean> {
	return mergeConstants(
		args['define'],
		args['define-bool'],
		args['define-number']
	);
}
