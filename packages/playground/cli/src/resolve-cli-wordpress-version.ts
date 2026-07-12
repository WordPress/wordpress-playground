/**
 * Uses the same prerelease captured by Playground's browser build when the
 * live WordPress beta channel is between release cycles.
 */
export async function resolveCliWordPressVersion(
	wordpressVersion: string
): Promise<string> {
	if (wordpressVersion !== 'beta') {
		return wordpressVersion;
	}
	const { MinifiedWordPressVersions } =
		await import('@wp-playground/wordpress-builds');
	return MinifiedWordPressVersions.beta;
}
