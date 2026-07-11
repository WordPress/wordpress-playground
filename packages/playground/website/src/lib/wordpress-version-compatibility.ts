import type { AllPHPVersion } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';

export function getDefaultPhpVersionForWordPress(
	wpVersion: string | undefined
): AllPHPVersion {
	return (
		getForcedPhpVersionForWordPress(wpVersion) ??
		(RecommendedPHPVersion as AllPHPVersion)
	);
}

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
