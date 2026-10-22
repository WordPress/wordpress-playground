/*
 * OPFS is browser-scoped, so storage tests must not overlap in one browser.
 * The dedicated CI lane uses one worker and Playwright's default mode, which
 * retries only a failed test instead of replaying an entire serial group.
 *
 * Every storage-sensitive test carries the `@storage` tag, so the CI routing
 * does not need to know which files contain storage tests.
 */
const storageTests = /@storage/;
// Pulls a real WordPress site served next to the runner; see
// playwright/reprint-site/serve.sh. Its own lane provisions that site.
const reprintImportTests = /@reprint-import/;

/**
 * Select one CI test group without running its storage or import tests elsewhere.
 *
 * The storage group uses one worker so tests cannot change the shared OPFS state
 * concurrently. The import group also uses one worker and needs the real WordPress
 * fixture provisioned by its CI job. The regular group excludes both tags and can
 * be sharded across parallel workers. Both origin setups use this same mapping;
 * otherwise a tagged test could run twice or lose its required server fixture.
 *
 * Reject a missing or unknown group rather than silently changing the CI workload.
 * The local split-origin config calls this only when a group was explicitly set.
 */
export function getTestGroupOptions(testGroup: string | undefined) {
	switch (testGroup) {
		case 'storage':
			// Storage tests share browser-scoped OPFS, so one worker prevents
			// them from changing the same storage concurrently.
			return { grep: storageTests, workers: 1 };
		case 'reprint-import':
			return { grep: reprintImportTests, workers: 1, retries: 1 };
		case 'regular':
			return { grepInvert: /@storage|@reprint-import/ };
		default:
			throw new Error(
				`Unsupported PLAYWRIGHT_TEST_GROUP: ${JSON.stringify(testGroup)}. ` +
					'Expected "regular", "storage" or "reprint-import".'
			);
	}
}
