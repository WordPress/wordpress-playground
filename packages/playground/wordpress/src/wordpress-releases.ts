import { createMemoizedFetch } from '@wp-playground/common';

const WORDPRESS_STABLE_CHECK_URL =
	'https://api.wordpress.org/core/stable-check/1.0/';
let fetchStableWordPressVersions:
	| ReturnType<typeof createMemoizedFetch>
	| undefined;

/**
 * Returns every stable WordPress release listed by the official release API.
 *
 * The request is created lazily and memoized because Blueprint constraint
 * resolution may inspect the catalog more than once during one page load.
 */
export async function getWordPressStableVersions(): Promise<string[]> {
	fetchStableWordPressVersions ??= createMemoizedFetch(globalThis.fetch);
	const response = await fetchStableWordPressVersions(
		WORDPRESS_STABLE_CHECK_URL
	);
	if (!response.ok) {
		throw new Error(
			`Could not load the WordPress release catalog: ` +
				`${response.status} ${response.statusText}`.trim()
		);
	}

	const releases = await response.json();
	if (!releases || typeof releases !== 'object' || Array.isArray(releases)) {
		throw new Error('The WordPress release catalog returned invalid data.');
	}

	return Object.keys(releases);
}
