/**
 * The shared Playground_SQLite_Integration_Loader class definition,
 * parameterized by the load_sqlite_integration() body.
 *
 * Used by both buildModernSqlitePreload (in index.ts) and
 * buildLegacySqlitePreload (in legacy-wp/legacy-sqlite-preload.ts).
 */
export function SQLITE_PRELOAD_LOADER_CLASS(loadBody: string): string {
	return `
/**
 * Loads the SQLite integration plugin before WordPress is loaded
 * and without creating a drop-in "db.php" file.
 *
 * Technically, it creates a global $wpdb object whose only two
 * purposes are to:
 *
 * * Exist – because the require_wp_db() WordPress function won't
 *           connect to MySQL if $wpdb is already set.
 * * Load the SQLite integration plugin the first time it's used
 *   and replace the global $wpdb reference with the SQLite one.
 *
 * This lets Playground keep the WordPress installation clean and
 * solves dillemas like:
 *
 * * Should we include db.php in Playground exports?
 * * Should we remove db.php from Playground imports?
 * * How should we treat stale db.php from long-lived OPFS sites?
 *
 * @see https://github.com/WordPress/wordpress-playground/discussions/1379 for
 *      more context.
 */
class Playground_SQLite_Integration_Loader {
	public function __call($name, $arguments) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		return call_user_func_array(
			array($GLOBALS['wpdb'], $name),
			$arguments
		);
	}
	public function __get($name) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		return $GLOBALS['wpdb']->$name;
	}
	public function __set($name, $value) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb – SQLite integration plugin could not be loaded');
		}
		$GLOBALS['wpdb']->$name = $value;
	}
    protected function load_sqlite_integration() {
        ${loadBody}
    }
}
/**
 * The Query Monitor plugin short-circuits in the CLI SAPI. However, in Playground,
 * the SAPI is always "cli" at the moment. Let's set a constant to disable the CLI
 * detection.
 *
 * @see https://github.com/WordPress/sqlite-database-integration/pull/212
 * @see https://github.com/WordPress/sqlite-database-integration/pull/215
 */
define('QM_TESTS', true);
$wpdb = $GLOBALS['wpdb'] = new Playground_SQLite_Integration_Loader();

/**
 * WordPress is capable of using a preloaded global $wpdb. However, if
 * it cannot find the drop-in db.php plugin it still checks whether
 * the mysqli_connect() function exists even though it's not used.
 *
 * What WordPress demands, Playground shall provide.
 */
`;
}
