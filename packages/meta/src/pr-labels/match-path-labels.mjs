// minimatch is a declared dependency of this directory's package.json, so it
// resolves like any other import. The workflow installs it with `npm ci` here;
// locally it comes from node_modules.
import { minimatch } from 'minimatch';

/**
 * Compute the path-based labels for a pull request.
 *
 * WHY this exists (instead of just using actions/labeler):
 *   actions/labeler reads a PR's changed files from GitHub's `pulls.listFiles`
 *   API, which makes GitHub generate the full PR diff. That request times out
 *   ("Sorry, this diff is taking too long to generate") on PRs that change a
 *   lot of binary data — e.g. recompiled PHP.wasm builds — and the action then
 *   fails the `paths` job, which is a required check, and blocks the merge.
 *   The caller lists changed files with `git diff` (which compares tree hashes
 *   and is instant regardless of PR size) and passes them here, so labeling
 *   no longer depends on GitHub's diff generation.
 *
 * WHAT is supported:
 *   Only the one labeler feature .github/labeler.yml actually uses —
 *
 *       <label>:
 *         - changed-files:
 *             - any-glob-to-any-file: [ ...globs ]
 *
 *   i.e. "apply <label> if any glob matches any changed file". Glob matching
 *   uses minimatch with `{ dot: true }`, identical to actions/labeler v5, so
 *   results match for this config.
 *
 *   Every other labeler feature (any-glob-to-all-files, all-globs-to-any-file,
 *   all-globs-to-all-files, base-branch, head-branch, or more than one entry
 *   under a label) is intentionally NOT implemented. Rather than silently
 *   ignore such a rule and mislabel PRs, this throws — so a future labeler.yml
 *   change fails loudly and whoever makes it extends this module (and its
 *   tests) instead.
 *
 * @param {string[]} changedFiles - Paths changed in the PR.
 * @param {Record<string, unknown>} config - Parsed .github/labeler.yml.
 * @returns {string[]} Labels whose globs match at least one changed file.
 */
export function matchPathLabels(changedFiles, config) {
	const labels = [];
	for (const [label, rules] of Object.entries(config ?? {})) {
		const globs = globsForLabel(label, rules);
		const matched = globs.some((glob) =>
			changedFiles.some((file) => minimatch(file, glob, { dot: true }))
		);
		if (matched) {
			labels.push(label);
		}
	}
	return labels;
}

/**
 * Extract the `any-glob-to-any-file` globs for one label, rejecting any config
 * shape this module does not implement (see WHAT is supported, above).
 */
function globsForLabel(label, rules) {
	if (!Array.isArray(rules) || rules.length !== 1) {
		throw unsupported(label, 'expected exactly one `changed-files` entry');
	}
	const [rule] = rules;
	const ruleKeys = Object.keys(rule ?? {});
	if (ruleKeys.length !== 1 || ruleKeys[0] !== 'changed-files') {
		throw unsupported(
			label,
			`only \`changed-files\` is supported, saw ${JSON.stringify(ruleKeys)}`
		);
	}
	const clauses = rule['changed-files'];
	if (!Array.isArray(clauses)) {
		throw unsupported(label, '`changed-files` must be a list');
	}

	const globs = [];
	for (const clause of clauses) {
		const clauseKeys = Object.keys(clause ?? {});
		if (
			clauseKeys.length !== 1 ||
			clauseKeys[0] !== 'any-glob-to-any-file'
		) {
			throw unsupported(
				label,
				`only \`any-glob-to-any-file\` is supported, saw ${JSON.stringify(
					clauseKeys
				)}`
			);
		}
		const value = clause['any-glob-to-any-file'];
		if (Array.isArray(value)) {
			globs.push(...value);
		} else if (typeof value === 'string') {
			globs.push(value);
		} else {
			throw unsupported(
				label,
				'`any-glob-to-any-file` must be a string or list of globs'
			);
		}
	}
	return globs;
}

function unsupported(label, detail) {
	return new Error(
		`Unsupported .github/labeler.yml rule for "${label}": ${detail}. ` +
			'packages/meta/src/pr-labels/match-path-labels.mjs implements only ' +
			'`changed-files: [{ any-glob-to-any-file: [...] }]`. Extend it and its ' +
			'tests to support the new rule.'
	);
}
