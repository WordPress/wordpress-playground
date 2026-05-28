import { RecommendedPHPVersion } from '@wp-playground/common';
import type { BlueprintPHPVersion, BlueprintV1Declaration } from './v1/types';

/**
 * Versions that may override the ones declared in a Blueprint.
 * Typically sourced from URL query params (`?wp=…&php=…`) or
 * CLI flags (`--wp …  --php …`).
 *
 * Empty strings are treated as "no override", matching the
 * historical behaviour of `URLSearchParams.get(...) || fallback`.
 */
export type BlueprintVersionOverrides = {
	wp?: string;
	php?: string;
};

/**
 * Returns a new Blueprint declaration whose `preferredVersions` reflect
 * the standard precedence rule used by both the website and the CLI:
 *
 *     external override (query/flag) > blueprint's preferredVersions > hardcoded default
 *
 * Defaults are `RecommendedPHPVersion` for PHP and `'latest'` for WordPress.
 *
 * If the input Blueprint opts out of WordPress entirely via
 * `preferredVersions.wp === false` (a "PHP-only" Blueprint), the input is
 * returned unchanged — overrides are intentionally ignored so the opt-out
 * is preserved. WordPress-only fields are rejected at compile time in that
 * mode, and applying a `wp` override here would defeat that contract.
 */
export function mergeBlueprintVersions(
	blueprint: BlueprintV1Declaration,
	overrides: BlueprintVersionOverrides
): BlueprintV1Declaration {
	if (blueprint.preferredVersions?.wp === false) {
		return blueprint;
	}

	const existing = blueprint.preferredVersions;
	return {
		...blueprint,
		preferredVersions: {
			php: (overrides.php || existing?.php || RecommendedPHPVersion) as
				| BlueprintPHPVersion
				| 'latest',
			wp: overrides.wp || existing?.wp || 'latest',
		},
	};
}
