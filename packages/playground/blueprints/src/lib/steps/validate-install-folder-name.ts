function isSinglePathSegmentName(name: string) {
	return (
		!!name &&
		name !== '.' &&
		name !== '..' &&
		!name.includes('/') &&
		!name.includes('\\') &&
		!name.includes('\0')
	);
}

/**
 * Validates the folder name used directly under wp-content/plugins or
 * wp-content/themes. This is a name, not a path, so do not normalize it.
 */
export function validateInstallFolderName(folderName: string, label: string) {
	if (!isSinglePathSegmentName(folderName)) {
		throw new Error(`${label} must be a single directory name.`);
	}
	return folderName;
}

/**
 * Validates a file name used directly under wp-content/plugins.
 */
export function validateInstallFileName(fileName: string, label: string) {
	if (!isSinglePathSegmentName(fileName)) {
		throw new Error(`${label} must be a single file name.`);
	}
	return fileName;
}
