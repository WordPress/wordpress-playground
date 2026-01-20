/**
 * Simple i18n pass-through functions.
 *
 * This module provides placeholder i18n functions that simply return
 * the input strings. In a full WordPress environment, these would be
 * replaced with actual translation functions from @wordpress/i18n.
 */

/**
 * Retrieve the translation of the given text.
 */
export function __(text: string): string {
	return text;
}

/**
 * Retrieve the translation with context.
 */
export function _x(text: string, _context: string): string {
	return text;
}

/**
 * Retrieve the singular or plural form based on the number.
 */
export function _n(single: string, plural: string, number: number): string {
	return number === 1 ? single : plural;
}

/**
 * Retrieve the singular or plural form with context.
 */
export function _nx(
	single: string,
	plural: string,
	number: number,
	_context: string
): string {
	return number === 1 ? single : plural;
}

/**
 * Format a string with placeholders.
 */
export function sprintf(format: string, ...args: unknown[]): string {
	let i = 0;
	return format.replace(/%[sd]/g, () => String(args[i++] ?? ''));
}
