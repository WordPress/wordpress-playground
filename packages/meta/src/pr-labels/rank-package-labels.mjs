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
 *   `[pathPrefix, label]` pairs. Order matters: the FIRST matching prefix wins,
 *   so longer / more specific prefixes must come before shorter ones.
 * @param {number} max - Most labels to return (default 3).
 * @returns {string[]} Up to `max` package labels, most-changed first.
 */
export function rankPackageLabels(fileStats, rules, max = 3) {
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

// Path prefix → [Package][...] label. Order matters (see `rules` above): the
// first matching prefix wins, so `web-service-worker` precedes `web`.
export const PACKAGE_RULES = [
	['packages/php-wasm/cli-util/', '[Package][@php-wasm] CLI-Util'],
	['packages/php-wasm/cli/', '[Package][@php-wasm] CLI'],
	['packages/php-wasm/compile/', '[Package][@php-wasm] Compile'],
	['packages/php-wasm/fs-journal/', '[Package][@php-wasm] FS Journal'],
	['packages/php-wasm/logger/', '[Package][@php-wasm] Logger'],
	['packages/php-wasm/node/', '[Package][@php-wasm] Node'],
	['packages/php-wasm/progress/', '[Package][@php-wasm] Progress'],
	['packages/php-wasm/scopes/', '[Package][@php-wasm] Scopes'],
	[
		'packages/php-wasm/stream-compression/',
		'[Package][@php-wasm] Stream Compression',
	],
	['packages/php-wasm/universal/', '[Package][@php-wasm] Universal'],
	['packages/php-wasm/util/', '[Package][@php-wasm] Util'],
	['packages/php-wasm/web-service-worker/', '[Package][@php-wasm] Web'],
	['packages/php-wasm/web/', '[Package][@php-wasm] Web'],
	['packages/php-wasm/xdebug-bridge/', '[Package][@php-wasm] Xdebug Bridge'],
	['packages/playground/blueprints/', '[Package][@wp-playground] Blueprints'],
	['packages/playground/cli/', '[Package][@wp-playground] CLI'],
	['packages/playground/client/', '[Package][@wp-playground] Client'],
	['packages/playground/common/', '[Package][@wp-playground] Common'],
	['packages/playground/components/', '[Package][@wp-playground] Components'],
	[
		'packages/playground/php-cors-proxy/',
		'[Package][@wp-playground] CORS Proxy',
	],
	['packages/playground/remote/', '[Package][@wp-playground] Remote'],
	['packages/playground/storage/', '[Package][@wp-playground] Storage'],
	['packages/playground/sync/', '[Package][@wp-playground] Sync'],
	[
		'packages/playground/website-extras/',
		'[Package][@wp-playground] Website',
	],
	['packages/playground/website/', '[Package][@wp-playground] Website'],
	[
		'packages/playground/wordpress-builds/',
		'[Package][@wp-playground] WordPress Builds',
	],
	['packages/playground/wordpress/', '[Package][@wp-playground] WordPress'],
];
