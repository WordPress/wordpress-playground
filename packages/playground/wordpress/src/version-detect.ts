import type { PHPRequestHandler } from '@php-wasm/universal';
import { SupportedWordPressVersions } from '@wp-playground/wordpress-builds';

export async function getLoadedWordPressVersion(
	requestHandler: PHPRequestHandler
): Promise<string> {
	const php = await requestHandler.getPrimaryPhp();
	const result = await php.run({
		code: `<?php
			require '${requestHandler.documentRoot}/wp-includes/version.php';
			echo $wp_version;
		`,
	});

	const versionString = result.text;
	if (!versionString) {
		throw new Error('Unable to read loaded WordPress version.');
	}
	return versionStringToLoadedWordPressVersion(versionString);
}

export function versionStringToLoadedWordPressVersion(
	wpVersionString: string
): string {
	const nightlyPattern = /-(alpha|beta|RC)\d*-\d+$/;
	if (nightlyPattern.test(wpVersionString)) {
		return 'nightly';
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

export function isSupportedWordPressVersion(wpVersion: string) {
	const supportedVersionKeys = Object.keys(SupportedWordPressVersions);
	return supportedVersionKeys.includes(wpVersion);
}
