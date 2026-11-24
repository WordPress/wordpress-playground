import type { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';

/**
 * Checks if database prerequisites are in place before attempting WordPress installation.
 * This performs lightweight checks that don't require WordPress to be installed.
 */
export async function assertDatabasePrerequisites(
	requestHandler: PHPRequestHandler,
	{
		usesSqlite,
		hasCustomDatabasePath,
	}: {
		usesSqlite: boolean;
		hasCustomDatabasePath: boolean;
	}
) {
	const php = await requestHandler.getPrimaryPhp();

	// If SQLite integration is preloaded via core, we're good
	if (php.isFile('/internal/shared/preload/0-sqlite.php')) {
		return;
	}

	// Check if a SQLite integration plugin directory exists (even if not provided via zip)
	// This handles cases where the directory is mounted via hooks
	const sqlitePluginPath = joinPaths(
		requestHandler.documentRoot,
		'wp-content/mu-plugins/sqlite-database-integration'
	);

	if (php.isDir(sqlitePluginPath)) {
		// The directory exists, we'll validate it after WordPress is installed
		return;
	}

	// Check if we provided a SQLite integration zip
	if (usesSqlite) {
		// We provided a zip, so SQLite will be set up during boot
		return;
	}

	// If we have a custom database path (dataSqlPath option was provided),
	// assume it's configured - the actual connection will be validated after installation
	if (hasCustomDatabasePath) {
		return;
	}

	// Check if wp-config.php has real MySQL credentials
	if (hasValidMySQLCredentials(php)) {
		return;
	}

	// No SQLite integration and no MySQL credentials found
	// Throw early to avoid attempting installation with no database
	throw new Error('Error connecting to the MySQL database.');
}

function hasValidMySQLCredentials(php: PHP) {
	const wpConfigPath = joinPaths(php.documentRoot, 'wp-config.php');
	if (!php.isFile(wpConfigPath)) return false;

	const wpConfig = php.readFileAsText(wpConfigPath);

	const dbName = wpConfig.match(
		/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]*)['"]/
	);
	const dbUser = wpConfig.match(
		/define\s*\(\s*['"]DB_USER['"]\s*,\s*['"]([^'"]*)['"]/
	);

	if (!dbName || !dbUser) return false;

	return dbName[1] !== 'database_name_here' && dbUser[1] !== 'username_here';
}
