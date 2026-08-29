/**
 * Infer a single `[Type]` label from a PR title's conventional-commit prefix.
 * Part of the Auto-label flow; unlike the path/package labels this needs no file
 * data, only the title.
 *
 * Only prefixes with an unambiguous target label are listed. refactor / chore /
 * test / build / ci are intentionally absent — they have no clean target label,
 * so we apply nothing rather than guess.
 *
 * @param {string} title - The PR title.
 * @param {[RegExp, string][]} rules - `[titlePrefixRegExp, label]` pairs.
 * @returns {string | null} The matching label, or null if none applies.
 */
export function matchTypeLabel(title, rules = TYPE_RULES) {
	const match = rules.find(([re]) => re.test(title));
	return match ? match[1] : null;
}

export const TYPE_RULES = [
	[/^fix(\(|:)/i, '[Type] Bug'],
	[/^feat(ure)?(\(|:)/i, '[Type] Enhancement'],
	[/^perf(\(|:)/i, '[Type] Performance'],
	[/^docs(\(|:)/i, '[Type] Documentation'],
];
