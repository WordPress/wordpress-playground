import type { SiteInfo } from '../redux/slice-sites';

const SETUP_QUERY_PARAMS = new Set([
	'blueprint',
	'blueprint-url',
	'core-pr',
	'gutenberg-branch',
	'gutenberg-pr',
	'import-content',
	'import-site',
	'import-wxr',
	'language',
	'login',
	'multisite',
	'name',
	'networking',
	'php',
	'plugin',
	'theme',
	'url',
	'wp',
]);

export function getSetupUrlFingerprint(url: URL) {
	return getSetupUrlFingerprintFromParts({
		searchParams: url.searchParams,
		hash: url.hash,
	});
}

export function getSetupUrlFingerprintFromSite(site: SiteInfo) {
	return (
		site.metadata.sourceSetupUrlFingerprint ||
		getSetupUrlFingerprintFromParts({
			searchParams: site.originalUrlParams?.searchParams,
			hash: site.originalUrlParams?.hash,
		})
	);
}

function getSetupUrlFingerprintFromParts({
	searchParams,
	hash,
}: {
	searchParams?: URLSearchParams | Record<string, string | string[]>;
	hash?: string;
}) {
	const normalizedParams = normalizeSetupSearchParams(searchParams);
	const normalizedHash = normalizeHash(hash);
	return JSON.stringify({
		search: normalizedParams,
		hash: normalizedHash,
	});
}

function normalizeSetupSearchParams(
	searchParams?: URLSearchParams | Record<string, string | string[]>
) {
	const params = new URLSearchParams();
	if (searchParams instanceof URLSearchParams) {
		for (const key of searchParams.keys()) {
			if (!SETUP_QUERY_PARAMS.has(key)) {
				continue;
			}
			for (const value of searchParams.getAll(key)) {
				params.append(key, value);
			}
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
				return valueA.localeCompare(valueB);
			}
			return keyA.localeCompare(keyB);
		});
}

function normalizeHash(hash?: string) {
	return hash?.replace(/^#/, '') || '';
}
