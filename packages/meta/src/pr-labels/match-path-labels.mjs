// minimatch is a declared dependency of this directory's package.json, so it
// resolves like any other import. The workflow installs it with `npm ci` here;
// locally it comes from node_modules.
import { minimatch } from 'minimatch';

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

// Path-based labels: the ones that map cleanly to paths AND have no count
// limit — [Aspect], [Focus], [Feature], and [Type] Documentation. A wide
// refactor can legitimately match many of them.
//
// [Package][...] labels are NOT here — rank-package-labels.mjs ranks packages
// by lines changed and caps the count. [Type] labels other than Documentation
// are NOT here either — match-type-label.mjs infers one from the PR title.
//
// This used to live in .github/labeler.yml (consumed by actions/labeler). Now
// that we match globs ourselves, it lives here as plain data alongside the
// other label rules — one source of truth, unit-testable, no YAML parsing.
export const PATH_LABEL_RULES = {
	// [Aspect] * — cross-cutting concerns inferable from paths.
	'[Aspect] Browser': [
		'packages/php-wasm/web/**',
		'packages/php-wasm/web-service-worker/**',
		'packages/playground/website/**',
		'packages/playground/remote/**',
	],
	'[Aspect] Node.js': [
		'packages/php-wasm/node/**',
		'packages/php-wasm/cli/**',
		'packages/playground/cli/**',
	],
	'[Aspect] Service Worker': [
		'packages/php-wasm/web-service-worker/**',
		'**/service-worker*.{ts,js}',
	],
	'[Aspect] Sqlite': ['**/sqlite*/**'],
	'[Aspect] WordPress': [
		'packages/playground/wordpress/**',
		'packages/playground/wordpress-builds/**',
	],
	'[Aspect] Website': [
		'packages/playground/website/**',
		'packages/playground/website-extras/**',
	],
	// [Feature] / [Focus] — only the few that map cleanly to paths.
	'[Feature] PHP.wasm': [
		'packages/php-wasm/compile/**',
		'packages/php-wasm/universal/**',
	],
	'[Focus] Developer Tools': [
		'packages/playground/devtools-extension/**',
		'packages/php-wasm/xdebug-bridge/**',
	],
	// [Type] Documentation — the one [Type] label with a clean path heuristic.
	'[Type] Documentation': ['packages/docs/**', '**/*.md'],
};
