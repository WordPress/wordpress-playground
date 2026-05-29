import type { RuntimeConfiguration } from '@wp-playground/blueprints';
import type { SiteInfo } from './redux/slice-sites';
import type { QueryAPIParams } from './url/router';

// Query API params that do not affect Playground setup must be named here.
// This makes typechecking fail when a new query param is added without
// classifying it as either setup-affecting or setup-irrelevant.
type NonSetupQueryParam = 'page-title';
type SetupQueryParam = Exclude<keyof QueryAPIParams, NonSetupQueryParam>;

const SETUP_QUERY_PARAM_KEYS = Object.keys({
	blueprint: true,
	'blueprint-url': true,
	'core-pr': true,
	'gutenberg-branch': true,
	'gutenberg-pr': true,
	'import-content': true,
	'import-site': true,
	'import-wxr': true,
	language: true,
	login: true,
	multisite: true,
	name: true,
	networking: true,
	php: true,
	'php-extension': true,
	plugin: true,
	theme: true,
	url: true,
	wp: true,
} satisfies Record<SetupQueryParam, true>) as SetupQueryParam[];

const SETUP_QUERY_PARAMS = new Set<string>(SETUP_QUERY_PARAM_KEYS);

/**
 * Returns a stable cache key for matching autosaves to setup URLs.
 *
 * The fingerprint deliberately ignores routing and lifecycle parameters such as
 * `site-slug`, `storage`, and `random`, so equivalent setup URLs compare equal.
 */
export function getAutosaveFingerprintFromURL(url: URL) {
	return getAutosaveFingerprintFromParts({
		searchParams: url.searchParams,
		hash: url.hash,
	});
}

/**
 * Returns a URL containing only query parameters that define Playground setup.
 *
 * New saved sites use this so routing, UI, and lifecycle query parameters from
 * the current page do not leak into persisted site metadata. Keeping this on
 * the same setup-param list as autosave fingerprints gives future setup query
 * params one place to register.
 */
export function getSetupUrlFromUrl(url: URL) {
	const setupUrl = new URL(url.href);
	setupUrl.search = '';
	for (const [key, value] of url.searchParams.entries()) {
		if (SETUP_QUERY_PARAMS.has(key)) {
			setupUrl.searchParams.append(key, value);
		}
	}
	return setupUrl;
}

/**
 * Returns the autosave fingerprint originally associated with a site.
 *
 * Existing saved sites may not have stored `sourceSetupUrlFingerprint`, so this
 * falls back to deriving the fingerprint from their original URL parameters.
 */
export function getAutosaveFingerprintFromSite(site: SiteInfo) {
	return (
		site.metadata.sourceSetupUrlFingerprint ||
		getAutosaveFingerprintFromParts({
			searchParams: site.originalUrlParams?.searchParams,
			hash: site.originalUrlParams?.hash,
		})
	);
}

/**
 * Returns the persisted-site runtime fingerprint used to decide whether the
 * mounted iframe can keep running.
 *
 * Unlike the autosave setup fingerprint, this does not describe the original
 * setup URL. It only tracks runtime options passed into an already selected
 * site's boot process.
 */
export function getRuntimeBootFingerprint(
	runtimeConfiguration: RuntimeConfiguration
) {
	return JSON.stringify(runtimeConfiguration);
}

/**
 * Returns a serialized autosave fingerprint from URL parts.
 *
 * Callers pass either live `URLSearchParams` from the current URL or the stored
 * search parameter record from site metadata. Both forms are normalized before
 * serialization so restore matching can compare them consistently.
 */
function getAutosaveFingerprintFromParts({
	searchParams,
	hash,
}: {
	searchParams?: URLSearchParams | Record<string, string | string[]>;
	hash?: string;
}) {
	const params = normalizeFingerprintParams(searchParams);
	return JSON.stringify({
		search: params,
		hash: normalizeHash(hash),
	});
}

/**
 * Returns autosave-affecting search parameters in deterministic order.
 *
 * Routing, UI, and cache-busting parameters are excluded because they do not
 * change the WordPress site being created. Repeated setup parameters are kept
 * and sorted by key and value. This means repeated parameters such as
 * `plugin=a&plugin=b` and `plugin=b&plugin=a` produce the same fingerprint.
 */
function normalizeFingerprintParams(
	searchParams?: URLSearchParams | Record<string, string | string[]>
) {
	const params = new URLSearchParams();
	if (searchParams instanceof URLSearchParams) {
		for (const [key, value] of searchParams.entries()) {
			if (!SETUP_QUERY_PARAMS.has(key)) {
				continue;
			}
			params.append(key, value);
		}
	} else if (searchParams) {
		for (const [key, value] of Object.entries(searchParams)) {
			if (!SETUP_QUERY_PARAMS.has(key)) {
				continue;
			}
			const values = Array.isArray(value) ? value : [value];
			for (const item of values) {
				params.append(key, item);
			}
		}
	}

	return Array.from(params.entries())
		.map(([key, value]) => [key, value] as const)
		.sort(([keyA, valueA], [keyB, valueB]) => {
			if (keyA === keyB) {
				return compareFingerprintPart(valueA, valueB);
			}
			return compareFingerprintPart(keyA, keyB);
		});
}

/**
 * Compares fingerprint parts without locale-sensitive collation.
 *
 * Fingerprints need the same sort order in every browser and Node.js runtime,
 * regardless of the user's locale.
 */
function compareFingerprintPart(left: string, right: string) {
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}
	return 0;
}

/**
 * Returns the normalized setup fragment without a leading hash marker.
 */
function normalizeHash(hash?: string) {
	return hash?.replace(/^#/, '') || '';
}
