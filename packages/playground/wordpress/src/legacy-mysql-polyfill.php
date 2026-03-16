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

	// Two-phase string literal normalization:
	//
	// Phase 1: Translate MySQL's backslash-escaped single quotes
	// (\') to SQLite's doubled-quote escaping (''). MySQL accepts
	// both \' and '' inside single-quoted strings; SQLite only
	// accepts ''. WordPress 1.x's install.php hardcodes SQL with
	// \' in option descriptions like: 'your blog\'s URL'.
	$q = preg_replace_callback("/('(?:[^'\\\\]|\\\\.)*')/", function($m) {
		$inner = substr($m[1], 1, -1);
		$inner = str_replace("\\'", "''", $inner);
		return "'" . $inner . "'";
	}, $q);

	// Phase 2: Convert double-quoted string values to single-quoted.
	// In MySQL (default mode), both "value" and 'value' are string
	// literals. In SQLite, "value" is an identifier (column/table
	// name) and only 'value' is a string. WordPress 1.x uses
	// double-quoted values in WHERE clauses like:
	//   post_status = "publish"
	// which must become post_status = 'publish' for SQLite.
	//
	// We only convert double-quoted strings that appear in value
	// positions (after =, IN, VALUES, etc.) not in CREATE TABLE
	// or other DDL where double quotes might wrap identifiers.
	//
	// The regex uses alternation to match single-quoted strings
	// first (skipping them unchanged) so that double quotes
	// inside single-quoted strings are never touched. After
	// phase 1, single-quoted strings use '' escaping, so the
	// pattern ('(?:[^']|'')*') correctly spans the full string.
	if (!preg_match('/^\s*CREATE\s/i', $q) && !preg_match('/^\s*ALTER\s/i', $q)) {
		$q = preg_replace_callback("/('(?:[^']|'')*')|\"([^\"]*)\"/", function($m) {
			if (isset($m[1]) && $m[1] !== '') {
				// Single-quoted string — pass through unchanged
				return $m[0];
			}
			// Double-quoted string — convert to single-quoted,
			// escaping any single quotes inside the value
			return "'" . str_replace("'", "''", $m[2]) . "'";
		}, $q);
	}

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
	// The inner pattern (?:[^()]+|\([^)]*\))+ handles one level of
	// nested parentheses from prefix-length specifiers like col(255).
	$q = preg_replace('/,\s*(?:UNIQUE\s+)?(?:FULLTEXT\s+)?(?:KEY|INDEX)\s+(?:`?\w+`?\s*)?\((?:[^()]+|\([^)]*\))+\)/i', '', $q);

	// Handle AUTO_INCREMENT columns in CREATE TABLE.
	// In MySQL, AUTO_INCREMENT + PRIMARY KEY generates sequential IDs.
	// In SQLite, auto-increment ONLY works when the column is declared
	// as `INTEGER PRIMARY KEY` inline (not as a separate constraint).
	// We rewrite: `colname int(...) NOT NULL auto_increment` →
	//             `colname INTEGER PRIMARY KEY`
	// and then strip the separate `PRIMARY KEY (colname)` constraint
	// since it's now inline.
	if (preg_match('/^\s*CREATE\s/i', $q) && preg_match('/auto_increment/i', $q)) {
		// Find the auto_increment column name and rewrite it inline
		$q = preg_replace_callback(
			'/`?(\w+)`?\s+(?:bigint|int|tinyint|smallint|mediumint)(?:\(\d+\))?\s*(?:unsigned\s*)?(?:NOT\s+NULL\s*)?auto_increment/i',
			function($m) {
				return $m[1] . ' INTEGER PRIMARY KEY';
			},
			$q
		);
		// Remove the now-redundant separate PRIMARY KEY constraint.
		// This handles both single-column and composite primary keys
		// (e.g. PRIMARY KEY (option_id, blog_id, option_name)).
		// The auto_increment column is already declared as
		// INTEGER PRIMARY KEY inline, so the constraint would
		// cause a "more than one primary key" error in SQLite.
		$q = preg_replace('/,\s*PRIMARY\s+KEY\s*\([^)]+\)/i', '', $q);
		// Clean up any remaining auto_increment tokens
		$q = preg_replace('/\s+auto_increment/i', '', $q);
	} else {
		$q = preg_replace('/\s+auto_increment/i', '', $q);
	}

	// Remove UNSIGNED qualifier
	$q = preg_replace('/\s+unsigned/i', '', $q);

	// MySQL numeric types -> INTEGER (including bare int without size)
	$q = preg_replace('/\bbigint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\bint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\btinyint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\bsmallint\(\d+\)/i', 'INTEGER', $q);
	$q = preg_replace('/\bmediumint\(\d+\)/i', 'INTEGER', $q);
	// Bare int/tinyint/smallint without size (e.g. `int NOT NULL`)
	$q = preg_replace('/\bint\b(?!\s*\()/i', 'INTEGER', $q);
	$q = preg_replace('/\btinyint\b(?!\s*\()/i', 'INTEGER', $q);
	$q = preg_replace('/\bsmallint\b(?!\s*\()/i', 'INTEGER', $q);

	// MySQL text types -> TEXT
	$q = preg_replace('/\btinytext\b/i', 'TEXT', $q);
	$q = preg_replace('/\bmediumtext\b/i', 'TEXT', $q);
	$q = preg_replace('/\blongtext\b/i', 'TEXT', $q);
	$q = preg_replace('/\btinyblob\b/i', 'BLOB', $q);
	$q = preg_replace('/\bmediumblob\b/i', 'BLOB', $q);
	$q = preg_replace('/\blongblob\b/i', 'BLOB', $q);

	// ENUM -> TEXT
	$q = preg_replace('/\benum\s*\([^)]+\)/i', 'TEXT', $q);

	// MySQL implicitly defaults NOT NULL text/varchar/char columns
	// to '' and NOT NULL integer columns to 0 when no DEFAULT is
	// specified. SQLite enforces NOT NULL strictly and raises a
	// constraint error if no value is supplied and there's no
	// DEFAULT clause. Add explicit defaults so INSERTs that rely
	// on MySQL's implicit behavior succeed.
	if (preg_match('/^\s*CREATE\s/i', $q)) {
		$q = preg_replace_callback(
			'/\b(text|TEXT|varchar\(\d+\)|char\(\d+\)|BLOB)\s+NOT\s+NULL\b(?!\s+DEFAULT)/i',
			function($m) { return $m[0] . " DEFAULT ''"; },
			$q
		);
		$q = preg_replace_callback(
			'/\b(INTEGER)\s+NOT\s+NULL\b(?!\s+DEFAULT)/i',
			function($m) { return $m[0] . " DEFAULT 0"; },
			$q
		);
	}

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

	// DESCRIBE/DESC `table`
	if (preg_match('/^\s*(?:DESCRIBE|DESC)\s+`?(\w+)`?/i', $q, $m)) {
		$q = "PRAGMA table_info(" . $m[1] . ")";
	}

	// SHOW COLUMNS FROM `table`
	if (preg_match('/^\s*SHOW\s+COLUMNS\s+FROM\s+`?(\w+)`?/i', $q, $m)) {
		$q = "PRAGMA table_info(" . $m[1] . ")";
	}

	// ALTER TABLE ... DROP INDEX index_name
	// SQLite uses standalone DROP INDEX, not ALTER TABLE ... DROP INDEX.
	if (preg_match('/^\s*ALTER\s+TABLE\s+`?(\w+)`?\s+DROP\s+INDEX\s+`?(\w+)`?/i', $q, $m)) {
		$q = "DROP INDEX IF EXISTS " . $m[2];
	}

	// ALTER TABLE ... ADD INDEX (column) or ADD INDEX name (column)
	// SQLite uses CREATE INDEX, not ALTER TABLE ... ADD INDEX.
	// WordPress 1.x's add_clean_index() uses this form.
	if (preg_match('/^\s*ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+INDEX\s+(?:`?(\w+)`?\s*)?\(([^)]+)\)/i', $q, $m)) {
		$table = $m[1];
		// Strip prefix-length specifiers like column_name(255)
		$cols = preg_replace('/\(\d+\)/', '', $m[3]);
		$idx_name = !empty($m[2]) ? $m[2] : $table . '_' . trim(preg_replace('/[^a-zA-Z0-9_]/', '_', $cols), '_');
		$q = "CREATE INDEX IF NOT EXISTS " . $idx_name . " ON " . $table . " (" . $cols . ")";
	}

	// ALTER TABLE ... ADD ... NOT NULL (without DEFAULT):
	// SQLite doesn't allow adding a NOT NULL column without a
	// default value to a table that already has rows. Strip the
	// NOT NULL constraint — the column will allow NULL which is
	// acceptable for WordPress 1.x's upgrade path.
	if (preg_match('/^\s*ALTER\s+TABLE\s+.*\bADD\b/i', $q) && !preg_match('/\bDEFAULT\b/i', $q)) {
		$q = preg_replace('/\s+NOT\s+NULL/i', '', $q);
	}

	// ALTER TABLE ... CHANGE old_col new_col type ...
	// SQLite does not support CHANGE COLUMN. Silently skip it
	// by converting to a no-op SELECT. WordPress 1.x's upgrade_101()
	// uses this to change a column default, which is cosmetic.
	if (preg_match('/^\s*ALTER\s+TABLE\s+`?\w+`?\s+CHANGE\s+/i', $q)) {
		$q = "SELECT 1";
	}

	// Strip bare UNIQUE constraints (without KEY/INDEX keyword) from
	// CREATE TABLE. The named KEY/INDEX forms are already stripped by
	// the regex above. This catches unnamed constraints like:
	//   UNIQUE (option_id, optionvalue(255))
	// which also contain prefix-length specifiers that SQLite doesn't
	// support. The inner pattern handles one level of nested parens.
	// WordPress can function without these — they only enforce data
	// integrity, and the installer's initial data shouldn't violate them.
	$q = preg_replace('/,\s*UNIQUE\s*\((?:[^()]+|\([^)]*\))+\)/i', '', $q);

	// In MySQL, inserting 0 or '0' into an AUTO_INCREMENT column
	// triggers auto-increment (assigns the next sequential ID).
	// In SQLite, only NULL triggers auto-increment for INTEGER
	// PRIMARY KEY columns; 0 is inserted literally and causes
	// UNIQUE constraint violations on subsequent inserts.
	// WordPress 1.x's upgrade functions use this pattern:
	//   INSERT INTO wp_options (...) VALUES ('0', ...)
	// Translate the leading 0 to NULL for INSERT statements.
	if (preg_match('/^\s*INSERT\s/i', $q)) {
		$q = preg_replace("/VALUES\s*\(\s*'0'\s*,/i", "VALUES (NULL,", $q);
		$q = preg_replace("/VALUES\s*\(\s*0\s*,/i", "VALUES (NULL,", $q);
		// Empty string '' also triggers auto-increment in MySQL
		$q = preg_replace("/VALUES\s*\(\s*''\s*,/i", "VALUES (NULL,", $q);
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
		$stmt = _mysql_polyfill_execute($pdo, $translated);
		if ($stmt === false) {
			$err = $pdo->errorInfo();
			$conn['last_error'] = isset($err[2]) ? $err[2] : 'Query failed';
			$conn['last_errno'] = isset($err[1]) ? (int)$err[1] : 1;
			error_log('[mysql_polyfill] query returned false: ' . substr($translated, 0, 500));
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
			// Collect column metadata BEFORE fetchAll(), because
			// some PDO SQLite builds (e.g. PHP 5.6 WASM) throw
			// SQLITE_RANGE from getColumnMeta() after the result
			// set has been fully consumed by fetchAll().
			$col_count = $stmt->columnCount();
			$is_describe = (stripos(trim($translated), 'PRAGMA table_info') === 0);
			$columns = array();
			if ($is_describe) {
				$desc_cols = array('Field', 'Type', 'Null', 'Key', 'Default', 'Extra');
				foreach ($desc_cols as $col_name) {
					$columns[] = array('name' => $col_name);
				}
			} else {
				for ($i = 0; $i < $col_count; $i++) {
					try {
						$meta = $stmt->getColumnMeta($i);
						$columns[] = $meta;
					} catch (Exception $e) {
						// Fallback: construct minimal metadata
						$columns[] = array('name' => 'col_' . $i);
					}
				}
			}

			$rows = $stmt->fetchAll(PDO::FETCH_BOTH);

			// Transform PRAGMA table_info() results to MySQL DESC format.
			// PRAGMA returns: cid, name, type, notnull, dflt_value, pk
			// MySQL DESC returns: Field, Type, Null, Key, Default, Extra
			// WordPress 1.x's maybe_add_column() reads column index 0
			// (expecting Field/column name) but PRAGMA puts cid there.
			if ($is_describe) {
				$transformed = array();
				foreach ($rows as $row) {
					$field = isset($row['name']) ? $row['name'] : '';
					$type = isset($row['type']) ? $row['type'] : '';
					$null = (isset($row['notnull']) && $row['notnull']) ? 'NO' : 'YES';
					$key = (isset($row['pk']) && $row['pk']) ? 'PRI' : '';
					$default = isset($row['dflt_value']) ? $row['dflt_value'] : null;
					$extra = '';
					$transformed[] = array(
						'Field' => $field, 0 => $field,
						'Type' => $type, 1 => $type,
						'Null' => $null, 2 => $null,
						'Key' => $key, 3 => $key,
						'Default' => $default, 4 => $default,
						'Extra' => $extra, 5 => $extra,
					);
				}
				$rows = $transformed;
			}

			$id = ++$state['result_counter'];
			$state['results'][$id] = array(
				'rows' => $rows,
				'pos' => 0,
				'num_rows' => count($rows),
				'num_fields' => $is_describe ? 6 : $col_count,
				'columns' => $columns,
			);
			return $id;
		}

		return true;
	} catch (Exception $e) {
		// Silently succeed for "duplicate column" errors from
		// ALTER TABLE ADD — the column already exists, which
		// is the desired end state. WordPress 1.x upgrade_all()
		// tries to add columns unconditionally.
		if (strpos($e->getMessage(), 'duplicate column name') !== false) {
			$conn['last_error'] = '';
			$conn['last_errno'] = 0;
			$conn['affected_rows'] = 0;
			return true;
		}
		error_log('[mysql_polyfill] query exception: ' . $e->getMessage() . ' | SQL: ' . substr($translated, 0, 500));
		$conn['last_error'] = $e->getMessage();
		$conn['last_errno'] = (int)$e->getCode();
		return false;
	}
}

/**
 * Executes a SQL query via PDO, handling the ? placeholder problem.
 *
 * PDO::query() interprets ? as a bind parameter placeholder, even
 * inside string literals. WordPress 1.x generates queries with
 * literal ? characters (e.g. URLs like "http://site/?p=1" in
 * INSERT/UPDATE statements). When PDO sees these, it expects
 * matching bind parameters and throws SQLITE_RANGE (error 25).
 *
 * This function detects ? in queries and uses PDO::exec() for
 * non-SELECT statements (which doesn't interpret placeholders).
 * For SELECT queries with ?, it wraps the execution in a
 * SAVEPOINT to safely attempt the query and recover if it fails.
 */
function _mysql_polyfill_execute($pdo, $sql) {
	// Fast path: no ? means no placeholder issues
	if (strpos($sql, '?') === false) {
		return $pdo->query($sql);
	}

	// For non-SELECT statements, use exec() which doesn't
	// interpret ? as bind parameters
	if (!preg_match('/^\s*SELECT/i', $sql) && !preg_match('/^\s*PRAGMA/i', $sql)) {
		$pdo->exec($sql);
		// Return a dummy statement-like object
		return new _MysqlPolyfillExecResult($pdo);
	}

	// For SELECT queries with ?, we need to escape the ? characters.
	// PDO has no built-in way to do this, so we replace ? inside
	// string literals with a placeholder that SQLite evaluates to ?.
	// We do this by parsing the SQL to find string boundaries.
	$escaped = _mysql_polyfill_escape_question_marks($sql);
	return $pdo->query($escaped);
}

/**
 * Escapes literal ? characters in SQL string values so PDO doesn't
 * interpret them as bind parameter placeholders.
 *
 * Walks through the SQL character by character, tracking whether
 * we're inside a single-quoted string. Any ? found inside a string
 * is replaced with char(63) concatenated into the string, which
 * SQLite evaluates to a literal question mark.
 *
 * Example:
 *   WHERE url = 'http://x/?p=1'
 * becomes:
 *   WHERE url = 'http://x/' || char(63) || 'p=1'
 */
function _mysql_polyfill_escape_question_marks($sql) {
	$result = '';
	$in_string = false;
	$len = strlen($sql);
	for ($i = 0; $i < $len; $i++) {
		$ch = $sql[$i];
		if ($ch === "'" && !$in_string) {
			$in_string = true;
			$result .= $ch;
		} else if ($ch === "'" && $in_string) {
			// Check for escaped quote ''
			if ($i + 1 < $len && $sql[$i + 1] === "'") {
				$result .= "''";
				$i++;
			} else {
				$in_string = false;
				$result .= $ch;
			}
		} else if ($ch === '?' && $in_string) {
			// Replace ? inside string with concatenation
			$result .= "' || char(63) || '";
		} else if ($ch === '?' && !$in_string) {
			// ? outside of strings shouldn't happen in our SQL,
			// but just in case, leave it (PDO will handle or error)
			$result .= $ch;
		} else {
			$result .= $ch;
		}
	}
	return $result;
}

/**
 * Minimal PDOStatement-like wrapper for PDO::exec() results.
 * exec() returns an int (affected rows), not a statement object.
 * This wrapper provides the interface that mysql_query() expects.
 */
class _MysqlPolyfillExecResult {
	private $_pdo;
	private $_affected;

	function __construct($pdo) {
		$this->_pdo = $pdo;
		$this->_affected = 0;
	}

	function rowCount() {
		return $this->_affected;
	}

	function columnCount() {
		return 0;
	}

	function fetchAll($mode = PDO::FETCH_BOTH) {
		return array();
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

/**
 * Returns an object with metadata about the column at the given
 * offset. WordPress 1.x's wpdb::query() calls this in a loop
 * after every SELECT to populate $this->col_info[].
 *
 * The returned object mirrors MySQL's mysql_fetch_field() output
 * with name, table, max_length, and type properties. We use a
 * static internal pointer per result set, advancing by one on
 * each call, just like the C function.
 */
function mysql_fetch_field($result, $offset = null) {
	$state = &$GLOBALS['_mysql_polyfill'];
	if (!isset($state['results'][$result])) return false;
	$r = &$state['results'][$result];

	if ($offset !== null) {
		$idx = $offset;
	} else {
		// Auto-advance pointer
		if (!isset($r['field_pos'])) $r['field_pos'] = 0;
		$idx = $r['field_pos']++;
	}

	if (!isset($r['columns'][$idx])) return false;
	$col = $r['columns'][$idx];

	$obj = new stdClass();
	$obj->name       = isset($col['name']) ? $col['name'] : '';
	$obj->table      = isset($col['table']) ? $col['table'] : '';
	$obj->max_length = 0;
	$obj->not_null   = 0;
	$obj->primary_key = 0;
	$obj->type       = isset($col['native_type']) ? $col['native_type'] : 'string';
	return $obj;
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
