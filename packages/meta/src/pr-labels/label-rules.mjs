// All of the Auto-label workflow's rule sets in one place, so a maintainer can
// read (and adjust) everything that drives PR labeling without hopping between
// files. The matching logic lives in the sibling modules — match-path-labels.mjs,
// rank-package-labels.mjs, match-type-label.mjs — each of which defaults to the
// rule set below.

// ---------------------------------------------------------------------------
// Path labels — [Aspect] / [Focus] / [Feature] / [Type] Documentation.
//
// `label -> globs`; a label applies when any glob matches any changed file
// (minimatch, { dot: true }). These are the labels that map cleanly to paths
// AND have no count limit — a wide refactor can legitimately match many.
//
// (This used to live in .github/labeler.yml, consumed by actions/labeler.)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Package labels — [Package][...].
//
// `[pathPrefix, label]` pairs. A changed file is attributed to the FIRST prefix
// it starts with, so longer / more specific prefixes must come before shorter
// ones (e.g. `web-service-worker` before `web`). rank-package-labels.mjs ranks
// packages by lines changed and caps the count, so a cross-cutting change does
// not produce a wall of package labels.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Type label — a single [Type] from the PR title's conventional-commit prefix.
//
// `[titlePrefixRegExp, label]` pairs. Only prefixes with an unambiguous target
// label are listed; refactor / chore / test / build / ci are intentionally
// absent, so we apply nothing rather than guess.
//
// Each pattern accepts an optional scope and an optional `!` breaking marker
// before the colon, matching the conventional-commits spec — e.g. `fix:`,
// `fix(cli):`, `fix!:`, and `feat(cli)!:` all match.
// ---------------------------------------------------------------------------
export const TYPE_RULES = [
	[/^fix(?:\([^)]*\))?!?:/i, '[Type] Bug'],
	[/^feat(?:ure)?(?:\([^)]*\))?!?:/i, '[Type] Enhancement'],
	[/^perf(?:\([^)]*\))?!?:/i, '[Type] Performance'],
	[/^docs(?:\([^)]*\))?!?:/i, '[Type] Documentation'],
];
