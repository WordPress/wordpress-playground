/**
 * Used by the export step to exclude the Playground-specific files
 * from the zip file. Keep it in sync with the list of files created
 * by WordPressPatcher.
 */
export const wpContentFilesExcludedFromExport = [
	'db.php',
	'plugins/sqlite-database-integration',
	'mu-plugins/playground-includes',
	'mu-plugins/0-playground.php',
];
