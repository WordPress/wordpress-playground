import { decodeBase64ToString } from '@wp-playground/common';

/**
 * Parse a blueprint from either a JSON string or base64-encoded JSON string.
 *
 * This is useful for parsing blueprints from URL fragments, where they might
 * be encoded as either plain JSON or base64-encoded JSON.
 *
 * @param rawData - The raw blueprint data (JSON or base64-encoded JSON)
 * @returns The parsed blueprint object
 * @throws Error if the data cannot be parsed as JSON or base64-encoded JSON
 *
 * @example
 * ```ts
 * // Parse plain JSON
 * parseBlueprint('{"landingPage": "/?p=4"}');
 *
 * // Parse base64-encoded JSON
 * parseBlueprint('eyJsYW5kaW5nUGFnZSI6ICIvP3A9NCJ9');
 * ```
 */
export function parseBlueprint(rawData: string): any {
	try {
		// First try parsing as plain JSON
		return JSON.parse(rawData);
	} catch {
		try {
			// If that fails, try decoding as base64 then parsing
			return JSON.parse(decodeBase64ToString(rawData));
		} catch {
			throw new Error('Invalid blueprint');
		}
	}
}
