import type { PHP } from '@php-wasm/universal';
import { SupportedWordPressVersions } from '@wp-playground/wordpress-builds';

export async function getLoadedWordPressVersion(
	php: PHP
): Promise<string | undefined> {
	const result = await php.run({
		code: `<?php
			if (is_file('${php.documentRoot}/wp-includes/version.php')) {
				require '${php.documentRoot}/wp-includes/version.php';
				echo $wp_version;
			}
		`,
	});

	let loadedVersion = '';
	const wpVersion = result.text;
	if (wpVersion) {
		if (wpVersion.includes('-alpha')) {
			loadedVersion = 'nightly';
		} else if (wpVersion.includes('-beta')) {
			loadedVersion = 'beta';
		} else {
			const majorMinorMatch = wpVersion.match(/^(\d+\.\d+)\.\d+$/);
			loadedVersion = majorMinorMatch ? majorMinorMatch[1] : '';
		}
	}

	if (!loadedVersion) {
		throw new Error('Unable to detected loaded WordPress version.');
	}

	return loadedVersion;
}

export function isSupportedWordPressVersion(wpVersion: string) {
	const supportedVersionKeys = Object.keys(SupportedWordPressVersions);
	return supportedVersionKeys.includes(wpVersion);
}
