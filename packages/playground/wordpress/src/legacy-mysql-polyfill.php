<?php
/**
 * mysql_* function polyfill for WordPress 1.x on PHP without
 * the native mysql extension.
 *
 * The PHP 5.6 web (WASM) build does not include the mysql
 * extension, so WordPress 1.x's calls to mysql_connect(),
 * mysql_query(), etc. would hit "Call to undefined function"
 * fatal errors. This polyfill defines those functions as
 * user-space PHP that delegates to PDO SQLite with basic
 * MySQL-to-SQLite SQL translation.
 *
 * The translation covers the subset of MySQL syntax that
 * WordPress 1.x actually uses: column types, AUTO_INCREMENT,
 * ENGINE/TYPE declarations, and a few MySQL-specific functions
 * and statements.
 *
 * When the native mysql extension IS available (e.g. in the
 * Node.js build connected to a MySQL wire protocol proxy),
 * function_exists() returns true and this entire file is skipped.
 */
if (function_exists('mysql_connect')) {
	return;
}

if (!defined('MYSQL_ASSOC')) { define('MYSQL_ASSOC', 1); }
if (!defined('MYSQL_NUM'))   { define('MYSQL_NUM', 2); }
if (!defined('MYSQL_BOTH'))  { define('MYSQL_BOTH', 3); }

$GLOBALS['_mysql_polyfill'] = array(
	'connections' => array(),
	'results' => array(),
	'last_link' => null,
	'link_counter' => 0,
	'result_counter' => 0,
);

/**
 * Connects to a SQLite database, ignoring $host/$user/$password.
 *
 * In the browser (WASM), the native mysql extension is unavailable
 * and TCP sockets are not supported, so connecting to a real MySQL
 * server (or the MySQL proxy) is not possible. This polyfill always
 * uses a local SQLite file as the storage backend.
 *
 * When the native mysql extension IS available (e.g. Node.js with
 * PHP 5.6 connected to a MySQL wire protocol proxy), function_exists()
 * returns true at the top of this file and this entire polyfill is
 * skipped — the real mysql_connect() handles the proxy connection.
 */
function mysql_connect($host = null, $user = null, $password = null) {
	$state = &$GLOBALS['_mysql_polyfill'];

	$doc_root = getenv('DOCUMENT_ROOT');
	if (!$doc_root) { $doc_root = '/wordpress'; }
	$db_dir = $doc_root . '/wp-content/database';
	if (!is_dir($db_dir)) {
		@mkdir($db_dir, 0777, true);
	}
	$db_path = $db_dir . '/.ht.sqlite';

	try {
		$pdo = new PDO('sqlite:' . $db_path);
		$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		$pdo->exec('PRAGMA journal_mode=WAL');
		$pdo->exec('PRAGMA busy_timeout=30000');
	} catch (Exception $e) {
		return false;
	}

	$id = ++$state['link_counter'];
	$state['connections'][$id] = array(
		'pdo' => $pdo,
		'last_error' => '',
		'last_errno' => 0,
		'affected_rows' => 0,
		'insert_id' => 0,
	);
	$state['last_link'] = $id;

	return $id;
}

function mysql_pconnect($host = null, $user = null, $password = null) {
	return mysql_connect($host, $user, $password);
}

function mysql_select_db($db, $link = null) {
	return true;
}

function _mysql_polyfill_get_link($link = null) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if ($link === null) {
		$link = $state['last_link'];
	}
	if (!isset($state['connections'][$link])) {
		return null;
	}
	return $link;
}

function _mysql_polyfill_get_conn($link = null) {
	$link = _mysql_polyfill_get_link($link);
	if ($link === null) return null;
	return $GLOBALS['_mysql_polyfill']['connections'][$link];
}

/**
 * Translates MySQL SQL to SQLite-compatible SQL.
 *
 * Handles the subset of MySQL syntax that WordPress 1.x uses:
 * column types, AUTO_INCREMENT, storage engine declarations,
 * and a few MySQL-specific functions and statements.
 */
function _mysql_polyfill_translate($query) {
	$q = $query;

	// Remove MySQL-specific table options
	$q = preg_replace('/\s+ENGINE\s*=\s*\w+/i', '', $q);
	$q = preg_replace('/\s+TYPE\s*=\s*\w+/i', '', $q);
	$q = preg_replace('/\s+DEFAULT\s+CHARSET\s*=\s*\w+/i', '', $q);
	$q = preg_replace('/\s+COLLATE\s*=\s*[\w_]+/i', '', $q);
	$q = preg_replace('/\s+CHARACTER\s+SET\s+\w+/i', '', $q);

	// Strip non-PRIMARY KEY/INDEX definitions from CREATE TABLE.
	// MySQL supports inline index definitions like:
	//   KEY post_name (post_name)
	//   UNIQUE KEY user_login (user_login)
	//   FULLTEXT KEY post_content (post_content)
	// SQLite does not support these inside CREATE TABLE (only PRIMARY KEY
	// and column-level UNIQUE). WordPress 1.0 will function without
	// secondary indexes — they only affect query performance.
	$q = preg_replace('/,\s*(?:UNIQUE\s+)?(?:FULLTEXT\s+)?(?:KEY|INDEX)\s+`?\w+`?\s*\([^)]+\)/i', '', $q);

	// Handle AUTO_INCREMENT — remove it; INTEGER PRIMARY KEY
	// auto-increments in SQLite automatically
	$q = preg_replace('/\s+auto_increment/i', '', $q);

	// Remove UNSIGNED qualifier
	$q = preg_replace('/\s+unsigned/i', '', $q);

	// MySQL numeric types -> INTEGER
	$q = preg_replace('/\bbigint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\bint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\btinyint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\bsmallint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\bmediumint\(\d+\)/i', 'INTEGER', $q);

	// MySQL text types -> TEXT
	$q = preg_replace('/\btinytext\b/i', 'TEXT', $q);
	$q = preg_replace('/\bmediumtext\b/i', 'TEXT', $q);
	$q = preg_replace('/\blongtext\b/i', 'TEXT', $q);
	$q = preg_replace('/\btinyblob\b/i', 'BLOB', $q);
	$q = preg_replace('/\bmediumblob\b/i', 'BLOB', $q);
	$q = preg_replace('/\blongblob\b/i', 'BLOB', $q);

	// ENUM -> TEXT
	$q = preg_replace('/\benum\s*\([^)]+\)/i', 'TEXT', $q);

	// MySQL functions -> SQLite equivalents
	$q = preg_replace('/\bNOW\(\)/i', "datetime('now','localtime')", $q);
	$q = preg_replace('/\bUNIX_TIMESTAMP\(\)/i', "strftime('%s','now')", $q);
	$q = preg_replace('/\bDAYOFMONTH\(([^)]+)\)/i', "cast(strftime('%d',\\1) as integer)", $q);
	$q = preg_replace('/\bYEAR\(([^)]+)\)/i', "cast(strftime('%Y',\\1) as integer)", $q);
	$q = preg_replace('/\bMONTH\(([^)]+)\)/i', "cast(strftime('%m',\\1) as integer)", $q);

	// SHOW TABLES LIKE '...'
	if (preg_match('/^\s*SHOW\s+TABLES\s+LIKE\s+[\'"]([^\'"]*?)[\'"]\s*$/i', $q, $m)) {
		$q = "SELECT name AS Tables_in_db FROM sqlite_master WHERE type='table' AND name LIKE '" . $m[1] . "'";
	}

	// SHOW TABLES (without LIKE)
	if (preg_match('/^\s*SHOW\s+TABLES\s*$/i', $q)) {
		$q = "SELECT name AS Tables_in_db FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
	}

	// DESCRIBE `table`
	if (preg_match('/^\s*DESCRIBE\s+`?(\w+)`?/i', $q, $m)) {
		$q = "PRAGMA table_info(" . $m[1] . ")";
	}

	// SHOW COLUMNS FROM `table`
	if (preg_match('/^\s*SHOW\s+COLUMNS\s+FROM\s+`?(\w+)`?/i', $q, $m)) {
		$q = "PRAGMA table_info(" . $m[1] . ")";
	}

	return $q;
}

function mysql_query($query, $link = null) {
	$link = _mysql_polyfill_get_link($link);
	if ($link === null) return false;

	$conn = &$GLOBALS['_mysql_polyfill']['connections'][$link];
	$pdo = $conn['pdo'];
	$state = &$GLOBALS['_mysql_polyfill'];

	$translated = _mysql_polyfill_translate($query);

	try {
		$stmt = $pdo->query($translated);
		if ($stmt === false) {
			$err = $pdo->errorInfo();
			$conn['last_error'] = isset($err[2]) ? $err[2] : 'Query failed';
			$conn['last_errno'] = isset($err[1]) ? (int)$err[1] : 1;
			return false;
		}

		$conn['last_error'] = '';
		$conn['last_errno'] = 0;
		$conn['affected_rows'] = $stmt->rowCount();

		try {
			$conn['insert_id'] = (int)$pdo->lastInsertId();
		} catch (Exception $e) {
			$conn['insert_id'] = 0;
		}

		if ($stmt->columnCount() > 0) {
			$rows = $stmt->fetchAll(PDO::FETCH_BOTH);
			$id = ++$state['result_counter'];
			$state['results'][$id] = array(
				'rows' => $rows,
				'pos' => 0,
				'num_rows' => count($rows),
				'num_fields' => $stmt->columnCount(),
				'columns' => array(),
			);
			for ($i = 0; $i < $stmt->columnCount(); $i++) {
				$meta = $stmt->getColumnMeta($i);
				$state['results'][$id]['columns'][] = $meta;
			}
			return $id;
		}

		return true;
	} catch (Exception $e) {
		$conn['last_error'] = $e->getMessage();
		$conn['last_errno'] = (int)$e->getCode();
		return false;
	}
}

function mysql_error($link = null) {
	$conn = _mysql_polyfill_get_conn($link);
	if ($conn === null) return 'No connection';
	return $conn['last_error'];
}

function mysql_errno($link = null) {
	$conn = _mysql_polyfill_get_conn($link);
	if ($conn === null) return 0;
	return $conn['last_errno'];
}

function mysql_affected_rows($link = null) {
	$conn = _mysql_polyfill_get_conn($link);
	if ($conn === null) return -1;
	return $conn['affected_rows'];
}

function mysql_insert_id($link = null) {
	$conn = _mysql_polyfill_get_conn($link);
	if ($conn === null) return 0;
	return $conn['insert_id'];
}

function mysql_fetch_object($result) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return null;
	$r = &$state['results'][$result];
	if ($r['pos'] >= $r['num_rows']) return null;
	$row = $r['rows'][$r['pos']++];

	$obj = new stdClass();
	foreach ($row as $key => $value) {
		if (is_string($key)) {
			$obj->$key = $value;
		}
	}
	return $obj;
}

function mysql_fetch_array($result, $type = MYSQL_BOTH) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return null;
	$r = &$state['results'][$result];
	if ($r['pos'] >= $r['num_rows']) return null;
	$row = $r['rows'][$r['pos']++];

	if ($type === MYSQL_ASSOC) {
		$assoc = array();
		foreach ($row as $key => $value) {
			if (is_string($key)) $assoc[$key] = $value;
		}
		return $assoc;
	}
	if ($type === MYSQL_NUM) {
		$num = array();
		foreach ($row as $key => $value) {
			if (is_int($key)) $num[] = $value;
		}
		return $num;
	}
	return $row;
}

function mysql_fetch_assoc($result) {
	return mysql_fetch_array($result, MYSQL_ASSOC);
}

function mysql_fetch_row($result) {
	return mysql_fetch_array($result, MYSQL_NUM);
}

function mysql_num_rows($result) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return 0;
	return $state['results'][$result]['num_rows'];
}

function mysql_num_fields($result) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return 0;
	return $state['results'][$result]['num_fields'];
}

function mysql_data_seek($result, $row) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return false;
	if ($row < 0 || $row >= $state['results'][$result]['num_rows']) return false;
	$state['results'][$result]['pos'] = $row;
	return true;
}

function mysql_result($result, $row, $field = 0) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return false;
	$r = &$state['results'][$result];
	if ($row >= $r['num_rows']) return false;
	$data = $r['rows'][$row];
	if (is_int($field)) {
		return isset($data[$field]) ? $data[$field] : false;
	}
	return isset($data[$field]) ? $data[$field] : false;
}

function mysql_free_result($result) {
	$state = &$GLOBALS['_mysql_polyfill'];
	unset($state['results'][$result]);
	return true;
}

function mysql_close($link = null) {
	$link = _mysql_polyfill_get_link($link);
	if ($link === null) return false;
	unset($GLOBALS['_mysql_polyfill']['connections'][$link]);
	return true;
}

function mysql_real_escape_string($str, $link = null) {
	$conn = _mysql_polyfill_get_conn($link);
	if ($conn === null) {
		return addslashes($str);
	}
	$pdo = $conn['pdo'];
	$quoted = $pdo->quote($str);
	// PDO::quote() wraps in single quotes; strip them
	return substr($quoted, 1, -1);
}

function mysql_escape_string($str) {
	return mysql_real_escape_string($str);
}

function mysql_get_server_info($link = null) {
	return '5.7.99-playground-polyfill';
}

function mysql_get_client_info() {
	return '5.7.99-playground-polyfill';
}

function mysql_ping($link = null) {
	$conn = _mysql_polyfill_get_conn($link);
	return $conn !== null;
}

function mysql_field_name($result, $offset) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return false;
	$cols = $state['results'][$result]['columns'];
	if (!isset($cols[$offset])) return false;
	return isset($cols[$offset]['name']) ? $cols[$offset]['name'] : false;
}

function mysql_field_type($result, $offset) {
	return 'string';
}

function mysql_field_len($result, $offset) {
	return 255;
}

function mysql_tablename($result, $i) {
	return mysql_result($result, $i, 0);
}

function mysql_list_tables($db, $link = null) {
	return mysql_query("SHOW TABLES", $link);
}
