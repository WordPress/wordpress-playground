import type { PHPRequestHandler } from '@php-wasm/universal';

export async function getLoadedWordPressVersion(
	requestHandler: PHPRequestHandler
): Promise<string> {
	const { php, reap } =
		await requestHandler.instanceManager.acquirePHPInstance();
	try {
		// wp-includes/version.php was introduced in WordPress 1.2.
		// Earlier versions (e.g. 1.0) don't have it — fall back to
		// checking wp-includes/vars.php which defines $wp_version
		// in those builds.
		const versionFile = php.fileExists(
			`${requestHandler.documentRoot}/wp-includes/version.php`
		)
			? 'wp-includes/version.php'
			: 'wp-includes/vars.php';

		let versionString: string;
		try {
			const result = await php.run({
				code: `<?php
					@require '${requestHandler.documentRoot}/${versionFile}';
					if (isset($wp_version)) {
						echo $wp_version;
					}
				`,
			});
			versionString = result.text;
		} catch (e) {
			// WordPress 1.x vars.php may reference functions or
			// globals that only exist during a full request, causing
			// a fatal error when loaded in isolation. Fall back to
			// extracting the version string with a regex instead.
			const rawPHP = php.readFileAsText(
				`${requestHandler.documentRoot}/${versionFile}`
			);
			const match = rawPHP.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
			versionString = match ? match[1] : '';
		}

		if (!versionString) {
			throw new Error('Unable to read loaded WordPress version.');
		}
		return versionStringToLoadedWordPressVersion(versionString);
	} finally {
		reap();
	}
}

/**
 * Returns a WordPress build version string, for a given WordPress version string.
 *
 * You can find the full list of supported build version strings in
 * packages/playground/wordpress-builds/src/wordpress/wp-versions.json
 *
 * Each released version will be converted to the major.minor format.
 * For example 6.6.1 will be converted to 6.6.
 *
 * Release candidates (RC) and beta releases are converted to "beta".
 *
 * Nightly releases are converted to "nightly".
 *
 * @param wpVersionString - A WordPress version string.
 * @returns A Playground WordPress build version.
 */
export function versionStringToLoadedWordPressVersion(
	wpVersionString: string
): string {
	const nightlyPattern = /-(alpha|beta|RC)\d*-\d+$/;
	if (nightlyPattern.test(wpVersionString)) {
		return 'trunk';
	}

	// TODO: Tighten this to detect specific old beta version, like 6.2-beta.
	const betaPattern = /-(beta|RC)\d*$/;
	if (betaPattern.test(wpVersionString)) {
		return 'beta';
	}

	const majorMinorMatch = wpVersionString.match(/^(\d+\.\d+)(?:\.\d+)?$/);
	if (majorMinorMatch !== null) {
		return majorMinorMatch[1];
	}

	// Return original version string if we could not parse it.
	// This is important to allow so folks can bring their own WP builds.
	return wpVersionString;
}
