/**
 * Parse an array of php.ini name-value pairs into an entries object.
 * Works similarly to parseDefineStringArguments - each pair of array elements
 * represents an entry name and its value.
 *
 * Format: --php-ini NAME value
 * Examples:
 *     --php-ini memory_limit 256M
 *     --php-ini xdebug.mode develop,trace,profile
 *
 * @param entries - An array where each pair is [name, value]
 * @returns An object mapping entry names to their string values
 */
export function parsePhpIniArguments(
	entries: string[]
): Record<string, string> {
	if (entries.length % 2 !== 0) {
		throw new Error(
			'Invalid php.ini entry format. Expected pairs of NAME value'
		);
	}

	const phpIniEntries: Record<string, string> = {};

	for (let i = 0; i < entries.length; i += 2) {
		const name = entries[i];
		const value = entries[i + 1];

		if (!name || !name.trim()) {
			throw new Error('php.ini entry name cannot be empty');
		}

		phpIniEntries[name.trim()] = value;
	}

	return phpIniEntries;
}
