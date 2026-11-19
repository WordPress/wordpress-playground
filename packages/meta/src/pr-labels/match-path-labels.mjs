// minimatch is a declared dependency of this directory's package.json, so it
// resolves like any other import. The workflow installs it with `npm ci` here;
// locally it comes from node_modules.
import { minimatch } from 'minimatch';
import { PATH_LABEL_RULES } from './label-rules.mjs';

/**
 * Compute the path-based labels for a pull request: apply a label when any of
 * its globs matches any changed file. Glob matching uses minimatch with
 * `{ dot: true }` (so dotfiles match), the same default actions/labeler used
 * before we replaced it.
 *
 * @param {string[]} changedFiles - Paths changed in the PR.
 * @param {Record<string, string[]>} rules - label -> globs (see
 *   PATH_LABEL_RULES).
 * @returns {string[]} Labels whose globs match at least one changed file.
 */
export function matchPathLabels(changedFiles, rules = PATH_LABEL_RULES) {
	const labels = [];
	for (const [label, globs] of Object.entries(rules)) {
		const matched = globs.some((glob) =>
			changedFiles.some((file) => minimatch(file, glob, { dot: true }))
		);
		if (matched) {
			labels.push(label);
		}
	}
	return labels;
}
