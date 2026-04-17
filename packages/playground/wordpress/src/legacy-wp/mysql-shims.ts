/**
 * PHP code that provides functional mysql_* function stubs.
 *
 * WP 1.x calls mysql_query(), mysql_list_tables(), mysql_fetch_row(),
 * etc. directly (not through $wpdb). These stubs delegate to $wpdb
 * (the SQLite driver) so the queries actually execute.
 *
 * A global array $_mysql_results tracks result sets returned by
 * mysql_query() and mysql_list_tables(), keyed by an integer ID.
 * mysql_fetch_row/mysql_fetch_object consume rows from these.
 *
 * All stubs are guarded by function_exists() so they're safe to
 * include multiple times or alongside real mysql_* extensions.
 *
 * This constant is interpolated into PHP template literals in both
 * boot.ts (db.php for WP < 3.0) and index.ts (0-sqlite.php preload).
 */
export const MYSQL_SHIMS_PHP = `
// WordPress < 3.0 wpdb::__construct calls mysql_set_charset directly.
if (!function_exists('mysql_set_charset')) {
	function mysql_set_charset() { return true; }
}
// Functional mysql_* stubs that delegate to $wpdb (SQLite driver).
$GLOBALS['_mysql_results'] = array();
$GLOBALS['_mysql_result_id'] = 0;
if (!function_exists('mysql_query')) {
	function mysql_query($query, $link = null) {
		global $wpdb;
		if (isset($wpdb) && method_exists($wpdb, 'query')) {
			$wpdb->query($query);
			if (preg_match('/^\\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)/i', $query)) {
				$rows = isset($wpdb->last_result) ? $wpdb->last_result : array();
				$id = ++$GLOBALS['_mysql_result_id'];
				$GLOBALS['_mysql_results'][$id] = array(
					'rows' => $rows,
					'index' => 0,
				);
				return $id;
			}
			return true;
		}
		return false;
	}
}
if (!function_exists('mysql_error')) {
	function mysql_error($link = null) {
		global $wpdb;
		if (isset($wpdb) && isset($wpdb->last_error)) {
			return $wpdb->last_error;
		}
		return '';
	}
}
if (!function_exists('mysql_list_tables')) {
	function mysql_list_tables($db = '', $link = null) {
		global $wpdb;
		if (isset($wpdb) && method_exists($wpdb, 'get_results')) {
			$tables = $wpdb->get_results(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
			);
			$rows = array();
			if ($tables) {
				foreach ($tables as $t) {
					$obj = new stdClass();
					$obj->name = is_object($t) ? $t->name : $t['name'];
					$rows[] = $obj;
				}
			}
			$id = ++$GLOBALS['_mysql_result_id'];
			$GLOBALS['_mysql_results'][$id] = array(
				'rows' => $rows,
				'index' => 0,
			);
			return $id;
		}
		return false;
	}
}
if (!function_exists('mysql_fetch_row')) {
	function mysql_fetch_row($result) {
		if (!isset($GLOBALS['_mysql_results'][$result])) return null;
		$r = &$GLOBALS['_mysql_results'][$result];
		if ($r['index'] >= count($r['rows'])) return null;
		$row = $r['rows'][$r['index']++];
		return array_values((array)$row);
	}
}
if (!function_exists('mysql_fetch_object')) {
	function mysql_fetch_object($result) {
		if (!isset($GLOBALS['_mysql_results'][$result])) return null;
		$r = &$GLOBALS['_mysql_results'][$result];
		if ($r['index'] >= count($r['rows'])) return null;
		return (object)(array)$r['rows'][$r['index']++];
	}
}
if (!function_exists('mysql_num_rows')) {
	function mysql_num_rows($result) {
		if (isset($GLOBALS['_mysql_results'][$result])) {
			return count($GLOBALS['_mysql_results'][$result]['rows']);
		}
		return 0;
	}
}
if (!function_exists('mysql_get_server_info')) {
	function mysql_get_server_info() { return '8.0.0'; }
}
if (!function_exists('mysql_affected_rows')) {
	function mysql_affected_rows() {
		global $wpdb;
		if (isset($wpdb) && isset($wpdb->rows_affected)) {
			return $wpdb->rows_affected;
		}
		return 0;
	}
}
if (!function_exists('mysql_insert_id')) {
	function mysql_insert_id() {
		global $wpdb;
		if (isset($wpdb) && isset($wpdb->insert_id)) {
			return $wpdb->insert_id;
		}
		return 0;
	}
}
if (!function_exists('mysql_free_result')) {
	function mysql_free_result($result) {
		unset($GLOBALS['_mysql_results'][$result]);
		return true;
	}
}
if (!function_exists('mysql_num_fields')) {
	function mysql_num_fields($result) {
		if (isset($GLOBALS['_mysql_results'][$result])
			&& !empty($GLOBALS['_mysql_results'][$result]['rows'])) {
			return count((array)$GLOBALS['_mysql_results'][$result]['rows'][0]);
		}
		return 0;
	}
}
if (!function_exists('mysql_real_escape_string')) {
	function mysql_real_escape_string($s) { return addslashes($s); }
}
if (!function_exists('mysql_escape_string')) {
	function mysql_escape_string($s) { return addslashes($s); }
}`;
