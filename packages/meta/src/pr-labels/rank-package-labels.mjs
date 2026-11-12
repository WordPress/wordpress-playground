import { PACKAGE_RULES } from './label-rules.mjs';

/**
 * Rank `[Package][...]` labels by how much of the PR touches each package and
 * return the top few. This is the second half of the Auto-label flow (the first
 * is path-glob labels in ./match-path-labels.mjs); both run off one `git diff`.
 *
 * WHY a cap: without one, a cross-cutting change accumulates a wall of package
 * labels and the signal is lost. We keep the 3 packages with the most churn.
 *
 * @param {{ path: string, lines: number }[]} fileStats
 *   One entry per changed file: its path and total lines changed
 *   (additions + deletions). Binary files count as 0 lines.
 * @param {[string, string][]} rules
 *   `[pathPrefix, label]` pairs (see PACKAGE_RULES). Order matters: the FIRST
 *   matching prefix wins, so longer / more specific prefixes come first.
 * @param {number} max - Most labels to return (default 3).
 * @returns {string[]} Up to `max` package labels, most-changed first.
 */
export function rankPackageLabels(fileStats, rules = PACKAGE_RULES, max = 3) {
	// Tally lines + file count per package label.
	const stats = new Map();
	for (const { path, lines } of fileStats) {
		const rule = rules.find(([prefix]) => path.startsWith(prefix));
		if (!rule) {
			continue;
		}
		const label = rule[1];
		const cur = stats.get(label) || { lines: 0, files: 0 };
		stats.set(label, { lines: cur.lines + lines, files: cur.files + 1 });
	}

	// Rank: lines desc, then file count desc, then label name for stable output.
	return [...stats.entries()]
		.sort(
			([a, sa], [b, sb]) =>
				sb.lines - sa.lines || sb.files - sa.files || a.localeCompare(b)
		)
		.slice(0, max)
		.map(([label]) => label);
}
