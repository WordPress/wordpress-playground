// Versions that were never released: 1.1, 1.3, 1.4, 2.4.
// Modern WP (5.0-6.2) is paired with PHP 7.4 because it's the newest
// PHP the legacy SQLite driver supports and is far enough from the
// PHP 5.2 leg to make regressions obvious.
export const WP_VERSIONS = [
	// Mid-modern WordPress (PHP 7.4).
	{ wp: '6.2', php: '7.4' },
	{ wp: '6.1', php: '7.4' },
	{ wp: '6.0', php: '7.4' },
	{ wp: '5.9', php: '7.4' },
	{ wp: '5.8', php: '7.4' },
	{ wp: '5.7', php: '7.4' },
	{ wp: '5.6', php: '7.4' },
	{ wp: '5.5', php: '7.4' },
	{ wp: '5.4', php: '7.4' },
	{ wp: '5.3', php: '7.4' },
	{ wp: '5.2', php: '7.4' },
	{ wp: '5.1', php: '7.4' },
	{ wp: '5.0', php: '7.4' },
	// Legacy WordPress on PHP 5.2 WASM.
	{ wp: '4.9', php: '5.2' },
	{ wp: '4.8', php: '5.2' },
	{ wp: '4.7', php: '5.2' },
	{ wp: '4.6', php: '5.2' },
	{ wp: '4.5', php: '5.2' },
	{ wp: '4.4', php: '5.2' },
	{ wp: '4.3', php: '5.2' },
	{ wp: '4.2', php: '5.2' },
	{ wp: '4.1', php: '5.2' },
	{ wp: '4.0', php: '5.2' },
	{ wp: '3.9', php: '5.2' },
	{ wp: '3.8', php: '5.2' },
	{ wp: '3.7', php: '5.2' },
	{ wp: '3.6', php: '5.2' },
	{ wp: '3.5', php: '5.2' },
	{ wp: '3.4', php: '5.2' },
	{ wp: '3.3', php: '5.2' },
	{ wp: '3.2', php: '5.2' },
	{ wp: '3.1', php: '5.2' },
	{ wp: '3.0', php: '5.2' },
	{ wp: '2.9', php: '5.2' },
	{ wp: '2.8', php: '5.2' },
	{ wp: '2.7', php: '5.2' },
	{ wp: '2.6', php: '5.2' },
	{ wp: '2.5', php: '5.2' },
	{ wp: '2.3', php: '5.2' },
	{ wp: '2.2', php: '5.2' },
	{ wp: '2.1', php: '5.2' },
	{ wp: '2.0', php: '5.2' },
	{ wp: '1.5', php: '5.2' },
	{ wp: '1.2', php: '5.2' },
	{ wp: '1.0', php: '5.2' },
];

export function getLegacyWordPressVersionMatrix(wpOnly = process.env.WP_ONLY) {
	if (!wpOnly) {
		return WP_VERSIONS;
	}
	const requestedVersions = new Set(wpOnly.split(',').map((s) => s.trim()));
	const matrix = WP_VERSIONS.filter(({ wp }) => requestedVersions.has(wp));
	if (matrix.length === 0) {
		throw new Error(`WP_ONLY did not match any tested versions: ${wpOnly}`);
	}
	return matrix;
}

export function getWordPressDownloadUrl(version) {
	return `https://wordpress.org/${getWordPressDownloadFilename(version)}`;
}

export function getWordPressDownloadFilename(version) {
	return `wordpress-${normalizeWordPressVersionForDownload(version)}.zip`;
}

// Versions >= 2.0 work as <major>.<minor> because wordpress.org redirects
// to the latest patch. Versions < 2.0 need explicit patch versions.
export function normalizeWordPressVersionForDownload(version) {
	const legacyVersionMap = {
		'1.0': '1.0.2',
		1.2: '1.2.2',
		1.5: '1.5.2',
	};
	return legacyVersionMap[version] ?? version;
}
