import type { PHPRequestHandler } from '@php-wasm/universal';
import { SupportedWordPressVersions } from '@wp-playground/wordpress-builds';

export async function getLoadedWordPressVersion(
	requestHandler: PHPRequestHandler
): Promise<string> {
	const php = await requestHandler.getPrimaryPhp();
	const result = await php.run({
		code: `<?php
			if (is_file('${requestHandler.documentRoot}/wp-includes/version.php')) {
				require '${requestHandler.documentRoot}/wp-includes/version.php';
				echo $wp_version;
			}
		`,
	});

	const versionString = result.text;
	if (!versionString) {
		throw new Error('Unable to read loaded WordPress version.');
	}

	const loadedVersion = versionStringToLoadedWordPressVersion(versionString);
	if (!loadedVersion) {
		throw new Error(
			`Unable to parse loaded WordPress version: '${versionString}'`
		);
	}

	return loadedVersion;
}

// TODO: Improve name
export function versionStringToLoadedWordPressVersion(
	wpVersionString: string
): string | undefined {
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

	return undefined;
}

export function isSupportedWordPressVersion(wpVersion: string) {
	const supportedVersionKeys = Object.keys(SupportedWordPressVersions);
	return supportedVersionKeys.includes(wpVersion);
}
