import type { AllPHPVersion } from '@php-wasm/universal';

/**
 * WordPress versions that ship as non-minified downloads from
 * wordpress.org (or via the Playground CORS proxy). The web worker
 * handles these via its `!isMinifiedVersion` branch in
 * playground-worker-endpoint-blueprints-v1.ts.
 *
 * Ordered newest-first so the UI dropdown shows the most recent
 * older versions at the top of the "older versions" group.
 */
export const OlderWordPressVersions = [
	// WP 6.0 – 6.2 work on PHP 7.4+ but run best on PHP 8.x. Still not
	// minified today, so they're fetched from wordpress.org like the
	// legacy bucket.
	'6.2',
	'6.1',
	'6.0',
	// WP 5.x — PHP 5.6.20+ required; PHP 7.4 is the safest choice.
	'5.9',
	'5.8',
	'5.7',
	'5.6',
	'5.5',
	'5.4',
	'5.3',
	'5.2',
	'5.1',
	'5.0',
	// WP 4.x — PHP 5.2.4+ required; our only 5.x WASM build is 5.2.
	'4.9',
	'4.8',
	'4.7',
	'4.6',
	'4.5',
	'4.4',
	'4.3',
	'4.2',
	'4.1',
	'4.0',
	// WP 3.x
	'3.9',
	'3.8',
	'3.7',
	'3.6',
	'3.5',
	'3.4',
	'3.3',
	'3.2',
	'3.1',
	'3.0',
	// WP 2.x (2.4 was never released)
	'2.9',
	'2.8',
	'2.7',
	'2.6',
	'2.5',
	'2.3',
	'2.2',
	'2.1',
	'2.0',
	// WP 1.x (1.1, 1.3, 1.4 were never released)
	'1.5',
	'1.2',
	'1.0',
] as const;

export type OlderWordPressVersion = (typeof OlderWordPressVersions)[number];

/**
 * Returns the PHP version a given WordPress release must run on
 * inside Playground, or `null` if any supported modern PHP version
 * will do.
 *
 * - WP < 5.0 (the legacy bucket): only our PHP 5.2 WASM build works.
 *   WP 4.x officially requires PHP 5.2.4+, but Playground's 5.6+
 *   builds have been retired so 5.2 is the only option available
 *   here.
 * - WP 5.0 – 6.2 (the older-but-not-legacy bucket): PHP 7.4 is the
 *   safest single choice — old enough for WP 5.0's PHP 5.2.4 era
 *   code (which runs fine on 7.4) yet new enough that nothing
 *   depends on PHP 5 quirks. PHP 8.x would work for WP 5.6+ but not
 *   reliably for WP 5.0 – 5.5, so we force 7.4 across the whole
 *   bucket.
 * - WP 6.3+ (the minified bucket): returns `null`. The UI lets the
 *   user pick any supported PHP version and we default to the
 *   recommended one.
 */
export function getForcedPhpVersionForWordPress(
	wpVersion: string | undefined
): AllPHPVersion | null {
	if (!wpVersion) {
		return null;
	}
	const major = parseFloat(wpVersion);
	if (!Number.isFinite(major)) {
		return null;
	}
	if (major < 5) {
		return '5.2';
	}
	if (major < 6.3) {
		return '7.4';
	}
	return null;
}

/** True for WP versions that live in the non-minified "older" bucket. */
export function isOlderWordPressVersion(
	wpVersion: string | undefined
): boolean {
	if (!wpVersion) {
		return false;
	}
	return (OlderWordPressVersions as readonly string[]).includes(wpVersion);
}
