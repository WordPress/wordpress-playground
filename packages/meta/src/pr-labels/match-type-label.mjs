import { TYPE_RULES } from './label-rules.mjs';

/**
 * Infer a single `[Type]` label from a PR title's conventional-commit prefix.
 * Part of the Auto-label flow; unlike the path/package labels this needs no file
 * data, only the title.
 *
 * @param {string} title - The PR title.
 * @param {[RegExp, string][]} rules - `[titlePrefixRegExp, label]` pairs (see
 *   TYPE_RULES).
 * @returns {string | null} The matching label, or null if none applies.
 */
export function matchTypeLabel(title, rules = TYPE_RULES) {
	const match = rules.find(([re]) => re.test(title));
	return match ? match[1] : null;
}
