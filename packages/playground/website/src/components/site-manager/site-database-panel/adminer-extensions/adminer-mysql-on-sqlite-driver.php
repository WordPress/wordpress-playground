<?php

/**
 * An Adminer driver for MySQL-on-SQLite.
 *
 * This implementation is based on Adminer\SqlDb and Adminer\Db classes.
 * It is modified to use the MySQL-on-SQLite driver instead of MySQLi.
 *
 * @see https://github.com/vrana/adminer/blob/eaad45a781a3e0d9fa04e3431c1826e81c061699/adminer/include/db.inc.php
 * @see https://github.com/vrana/adminer/blob/eaad45a781a3e0d9fa04e3431c1826e81c061699/adminer/drivers/mysql.inc.php
 */

namespace Adminer;

// Load the SQLite driver.
require_once '/internal/shared/sqlite-database-integration/version.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/parser/class-wp-parser-grammar.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/parser/class-wp-parser.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/parser/class-wp-parser-node.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/parser/class-wp-parser-token.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/mysql/class-wp-mysql-token.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/mysql/class-wp-mysql-lexer.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/mysql/class-wp-mysql-parser.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-query-rewriter.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-lexer.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-token.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-pdo-user-defined-functions.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-sqlite-connection.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-sqlite-configurator.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-sqlite-driver.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-sqlite-driver-exception.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-sqlite-information-schema-builder.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-sqlite-information-schema-exception.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-sqlite-information-schema-reconstructor.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-pdo-proxy-statement.php';
require_once '/internal/shared/sqlite-database-integration/wp-includes/sqlite-ast/class-wp-pdo-mysql-on-sqlite.php';

use Throwable;
use WP_SQLite_Driver;
use WP_SQLite_Connection;
use PDO;

SqlDriver::$drivers = array("server" => "MySQL / MariaDB") + SqlDriver::$drivers;

if (!defined('Adminer\DRIVER')) {
	define('Adminer\DRIVER', "server"); // server - backwards compatibility

	/**
	 * WP_SQLite_Driver integration for Adminer.
	 *
	 * @see https://github.com/vrana/adminer/blob/eaad45a781a3e0d9fa04e3431c1826e81c061699/adminer/include/db.inc.php
	 * @see https://github.com/vrana/adminer/blob/eaad45a781a3e0d9fa04e3431c1826e81c061699/adminer/drivers/mysql.inc.php
	 */
	class Db extends SqlDb {
		/**
		 * Database extension name.
		 *
		 * @var string
		 */
		public $extension = 'MySQL on SQLite';

		/**
		 * Flavor of the database.
		 *
		 * @var string
		 */
		public $flavor = 'SQLite';

		/**
		 * Server version information.
		 *
		 * @var string
		 */
		public $server_info = '8.0.38';

		/**
		 * Number of affected rows by the last query.
		 *
		 * @var int
		 */
		public $affected_rows = 0;

		/**
		 * Information about the last query.
		 *
		 * @see https://php.net/mysql_info
		 */
		public $info = '';

		/**
		 * Error number of the last query.
		 *
		 * @var int
		 */
		public $errno = 0;

		/**
		 * Error message of the last query.
		 *
		 * @var string
		 */
		public $error = '';

		/**
		 * Used for multi-query support.
		 *
		 * @var Result|bool
		 */
		protected $multi;

		/**
		 * WP_SQLite_Driver instance.
		 *
		 * @var WP_SQLite_Driver
		 */
		public $driver;

		function attach($server, $username, $password) {
			$pdo = new PDO('sqlite:/wordpress/wp-content/database/.ht.sqlite');
			$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			$this->driver = new WP_SQLite_Driver(
				new WP_SQLite_Connection(array('pdo' => $pdo)),
				'wordpress'
			);
			return $this;
		}

		function set_charset($charset) {
			return true;
		}

		function next_result() {
			return false;
		}

		function quote($string) {
			return $this->driver->get_connection()->quote($string);
		}

		function select_db($database) {
			$this->driver->query(sprintf('USE %s', $this->driver->get_connection()->quote_identifier($database)));
			return true;
		}

		function query($query, $unbuffered = false) {
			try {
				$this->affected_rows = 0;
				$results = $this->driver->query($query);
				if (is_int($results)) {
					$this->affected_rows = $results;
				}
				$columns = $this->driver->get_last_column_meta();
				return new Result(is_array($results) ? $results : array(), $columns);
			} catch (Throwable $e) {
				return new Result(array(), array());
			}
		}
	}

	/**
	 * Result representation in Adminer-compatible format.
	 *
	 * @see https://github.com/vrana/adminer/blob/eaad45a781a3e0d9fa04e3431c1826e81c061699/adminer/include/pdo.inc.php
	 * @see https://github.com/vrana/adminer/blob/eaad45a781a3e0d9fa04e3431c1826e81c061699/adminer/drivers/mysql.inc.php
	 */
	class Result {
		/** @var */
		public $num_rows;

		/** @var array */
		private $rows;

		/** @var array */
		private $columns;

		/** @var int */
		private $row_offset = 0;

		/** @var int */
		private $col_offset = 0;

		function __construct($rows, $columns) {
			$this->num_rows = count($rows);
			$this->rows = $rows;
			$this->columns = $columns;
		}

		function fetch_assoc() {
			return (array) $this->rows[$this->row_offset++];
		}

		function fetch_row() {
			return array_values((array) $this->rows[$this->row_offset++]);
		}

		function fetch_field(): \stdClass {
			$column = $this->columns[$this->col_offset++];

			// Adminer expects MySQLi-like column metadata rather than PDO syntax.
			// The SQLite driver provides it in "mysqli:" prefixed metadata keys.
			foreach ($column as $key => $value) {
				if (strpos($key, 'mysqli:') === 0) {
					$column[substr($key, 7)] = $value;
				}
			}
			return (object) $column;
		}
	}

	/*
	 * The rest of the code in this file is from the original Adminer code.
	 *
	 * @see https://github.com/vrana/adminer/blob/eaad45a781a3e0d9fa04e3431c1826e81c061699/adminer/drivers/mysql.inc.php
	 */

	class Driver extends SqlDriver {
		static $extensions = array("MySQLi", "MySQL", "PDO_MySQL");
		static $jush = "sql"; // JUSH identifier

		public $unsigned = array("unsigned", "zerofill", "unsigned zerofill");
		public $operators = array("=", "<", ">", "<=", ">=", "!=", "LIKE", "LIKE %%", "REGEXP", "IN", "FIND_IN_SET", "IS NULL", "NOT LIKE", "NOT REGEXP", "NOT IN", "IS NOT NULL", "SQL");
		public $functions = array("char_length", "date", "from_unixtime", "lower", "round", "floor", "ceil", "sec_to_time", "time_to_sec", "upper");
		public $grouping = array("avg", "count", "count distinct", "group_concat", "max", "min", "sum");

		static function connect($server,$username,$password) {
			$connection = parent::connect($server, $username, $password);
			if (is_string($connection)) {
				if (function_exists('iconv') && !is_utf8($connection) && strlen($s = iconv("windows-1250", "utf-8", $connection)) > strlen($connection)) { // windows-1250 - most common Windows encoding
					$connection = $s;
				}
				return $connection;
			}
			$connection->set_charset(charset($connection));
			$connection->query("SET sql_quote_show_create = 1, autocommit = 1");
			$connection->flavor = (preg_match('~MariaDB~', $connection->server_info) ? 'maria' : 'mysql');
			add_driver(DRIVER, ($connection->flavor == 'maria' ? "MariaDB" : "MySQL"));
			return $connection;
		}

		function __construct($connection) {
			parent::__construct($connection);
			$this->types = array(
				lang('Numbers') => array("tinyint" => 3, "smallint" => 5, "mediumint" => 8, "int" => 10, "bigint" => 20, "decimal" => 66, "float" => 12, "double" => 21),
				lang('Date and time') => array("date" => 10, "datetime" => 19, "timestamp" => 19, "time" => 10, "year" => 4),
				lang('Strings') => array("char" => 255, "varchar" => 65535, "tinytext" => 255, "text" => 65535, "mediumtext" => 16777215, "longtext" => 4294967295),
				lang('Lists') => array("enum" => 65535, "set" => 64),
				lang('Binary') => array("bit" => 20, "binary" => 255, "varbinary" => 65535, "tinyblob" => 255, "blob" => 65535, "mediumblob" => 16777215, "longblob" => 4294967295),
				lang('Geometry') => array("geometry" => 0, "point" => 0, "linestring" => 0, "polygon" => 0, "multipoint" => 0, "multilinestring" => 0, "multipolygon" => 0, "geometrycollection" => 0),
			);
			$this->insertFunctions = array(
				"char" => "md5/sha1/password/encrypt/uuid",
				"binary" => "md5/sha1",
				"date|time" => "now",
			);
			$this->editFunctions = array(
				number_type() => "+/-",
				"date" => "+ interval/- interval",
				"time" => "addtime/subtime",
				"char|text" => "concat",
			);
			if (min_version('5.7.8', 10.2, $connection)) {
				$this->types[lang('Strings')]["json"] = 4294967295;
			}
			if (min_version('', 10.7, $connection)) {
				$this->types[lang('Strings')]["uuid"] = 128;
				$this->insertFunctions['uuid'] = 'uuid';
			}
			if (min_version(9, '', $connection)) {
				$this->types[lang('Numbers')]["vector"] = 16383;
				$this->insertFunctions['vector'] = 'string_to_vector';
			}
			if (min_version(5.1, '', $connection)) {
				$this->partitionBy = array("HASH", "LINEAR HASH", "KEY", "LINEAR KEY", "RANGE", "LIST");
			}
			if (min_version(5.7, 10.2, $connection)) {
				$this->generated = array("STORED", "VIRTUAL");
			}
		}

		function unconvertFunction($field) {
			return (preg_match("~binary~", $field["type"]) ? "<code class='jush-sql'>UNHEX</code>"
				: ($field["type"] == "bit" ? doc_link(array('sql' => 'bit-value-literals.html'), "<code>b''</code>")
				: (preg_match("~geometry|point|linestring|polygon~", $field["type"]) ? "<code class='jush-sql'>GeomFromText</code>"
				: "")));
		}

		function insert($table, $set) {
			return ($set ? parent::insert($table, $set) : queries("INSERT INTO " . table($table) . " ()\nVALUES ()"));
		}

		function insertUpdate($table, $rows, $primary) {
			$columns = array_keys(reset($rows));
			$prefix = "INSERT INTO " . table($table) . " (" . implode(", ", $columns) . ") VALUES\n";
			$values = array();
			foreach ($columns as $key) {
				$values[$key] = "$key = VALUES($key)";
			}
			$suffix = "\nON DUPLICATE KEY UPDATE " . implode(", ", $values);
			$values = array();
			$length = 0;
			foreach ($rows as $set) {
				$value = "(" . implode(", ", $set) . ")";
				if ($values && (strlen($prefix) + $length + strlen($value) + strlen($suffix) > 1e6)) { // 1e6 - default max_allowed_packet
					if (!queries($prefix . implode(",\n", $values) . $suffix)) {
						return false;
					}
					$values = array();
					$length = 0;
				}
				$values[] = $value;
				$length += strlen($value) + 2; // 2 - strlen(",\n")
			}
			return queries($prefix . implode(",\n", $values) . $suffix);
		}

		function slowQuery($query, $timeout) {
			if (min_version('5.7.8', '10.1.2')) {
				if ($this->conn->flavor == 'maria') {
					return "SET STATEMENT max_statement_time=$timeout FOR $query";
				} elseif (preg_match('~^(SELECT\b)(.+)~is', $query, $match)) {
					return "$match[1] /*+ MAX_EXECUTION_TIME(" . ($timeout * 1000) . ") */ $match[2]";
				}
			}
		}

		function convertSearch($idf, $val, $field) {
			return (preg_match('~char|text|enum|set~', $field["type"]) && !preg_match("~^utf8~", $field["collation"]) && preg_match('~[\x80-\xFF]~', $val['val'])
				? "CONVERT($idf USING " . charset($this->conn) . ")"
				: $idf
			);
		}

		function warnings() {
			$result = $this->conn->query("SHOW WARNINGS");
			if ($result && $result->num_rows) {
				ob_start();
				print_select_result($result); // print_select_result() usually needs to print a big table progressively
				return ob_get_clean();
			}
		}

		function tableHelp($name, $is_view = false) {
			$maria = ($this->conn->flavor == 'maria');
			if (information_schema(DB)) {
				return strtolower("information-schema-" . ($maria ? "$name-table/" : str_replace("_", "-", $name) . "-table.html"));
			}
			if (DB == "mysql") {
				return ($maria ? "mysql$name-table/" : "system-schema.html"); //! more precise link
			}
		}

		function partitionsInfo($table) {
			$from = "FROM information_schema.PARTITIONS WHERE TABLE_SCHEMA = " . q(DB) . " AND TABLE_NAME = " . q($table);
			$result = $this->conn->query("SELECT PARTITION_METHOD, PARTITION_EXPRESSION, PARTITION_ORDINAL_POSITION $from ORDER BY PARTITION_ORDINAL_POSITION DESC LIMIT 1");
			$return = array();
			list($return["partition_by"], $return["partition"], $return["partitions"]) = $result->fetch_row();
			$partitions = get_key_vals("SELECT PARTITION_NAME, PARTITION_DESCRIPTION $from AND PARTITION_NAME != '' ORDER BY PARTITION_ORDINAL_POSITION");
			$return["partition_names"] = array_keys($partitions);
			$return["partition_values"] = array_values($partitions);
			return $return;
		}

		function hasCStyleEscapes() {
			static $c_style;
			if ($c_style === null) {
				$sql_mode = get_val("SHOW VARIABLES LIKE 'sql_mode'", 1, $this->conn);
				$c_style = (strpos($sql_mode, 'NO_BACKSLASH_ESCAPES') === false);
			}
			return $c_style;
		}

		function engines() {
			$return = array();
			foreach (get_rows("SHOW ENGINES") as $row) {
				if (preg_match("~YES|DEFAULT~", $row["Support"])) {
					$return[] = $row["Engine"];
				}
			}
			return $return;
		}

		function indexAlgorithms($tableStatus) {
			return (preg_match('~^(MEMORY|NDB)$~', $tableStatus["Engine"]) ? array("HASH", "BTREE") : array());
		}
	}



	/** Escape database identifier */
	function idf_escape($idf) {
		return "`" . str_replace("`", "``", $idf) . "`";
	}

	/** Get escaped table name */
	function table($idf) {
		return idf_escape($idf);
	}

	/** Get cached list of databases
	* @return list<string>
	*/
	function get_databases($flush) {
		// SHOW DATABASES can take a very long time so it is cached
		$return = get_session("dbs");
		if ($return === null) {
			$query = "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME"; // SHOW DATABASES can be disabled by skip_show_database
			$return = ($flush ? slow_query($query) : get_vals($query));
			restart_session();
			set_session("dbs", $return);
			stop_session();
		}
		return $return;
	}

	/** Formulate SQL query with limit
	* @param string $query everything after SELECT
	* @param string $where including WHERE
	*/
	function limit($query, $where, $limit, $offset = 0, $separator = " ") {
		return " $query$where" . ($limit ? $separator . "LIMIT $limit" . ($offset ? " OFFSET $offset" : "") : "");
	}

	/** Formulate SQL modification query with limit 1
	* @param string $query everything after UPDATE or DELETE
	*/
	function limit1($table, $query, $where, $separator = "\n") {
		return limit($query, $where, 1, 0, $separator);
	}

	/** Get database collation
	* @param string[][] $collations result of collations()
	*/
	function db_collation($db, $collations) {
		$return = null;
		$create = get_val("SHOW CREATE DATABASE " . idf_escape($db), 1);
		if (preg_match('~ COLLATE ([^ ]+)~', $create, $match)) {
			$return = $match[1];
		} elseif (preg_match('~ CHARACTER SET ([^ ]+)~', $create, $match)) {
			// default collation
			$return = $collations[$match[1]][-1];
		}
		return $return;
	}

	/** Get logged user */
	function logged_user() {
		return get_val("SELECT USER()");
	}

	/** Get tables list
	* @return string[] [$name => $type]
	*/
	function tables_list() {
		return get_key_vals("SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME");
	}

	/** Count tables in all databases
	* @param list<string> $databases
	* @return int[] [$db => $tables]
	*/
	function count_tables($databases) {
		$return = array();
		foreach ($databases as $db) {
			$return[$db] = count(get_vals("SHOW TABLES IN " . idf_escape($db)));
		}
		return $return;
	}

	/** Get table status
	* @param bool $fast return only "Name", "Engine" and "Comment" fields
	* @return array<string, TableStatus>
	*/
	function table_status($name = "", $fast = false) {
		$return = array();
		foreach (
			get_rows(
				$fast
				? "SELECT TABLE_NAME AS Name, ENGINE AS Engine, TABLE_COMMENT AS Comment FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() " . ($name != "" ? "AND TABLE_NAME = " . q($name) : "ORDER BY Name")
				: "SHOW TABLE STATUS" . ($name != "" ? " LIKE " . q(addcslashes($name, "%_\\")) : "")
			) as $row
		) {
			if ($row["Engine"] == "InnoDB") {
				// ignore internal comment, unnecessary since MySQL 5.1.21
				$row["Comment"] = preg_replace('~(?:(.+); )?InnoDB free: .*~', '\1', $row["Comment"]);
			}
			if (!isset($row["Engine"])) {
				$row["Comment"] = "";
			}
			if ($name != "") {
				// MariaDB: Table name is returned as lowercase on macOS, so we fix it here.
				$row["Name"] = $name;
			}
			$return[$row["Name"]] = $row;
		}
		return $return;
	}

	/** Find out whether the identifier is view
	* @param TableStatus $table_status
	*/
	function is_view($table_status) {
		return $table_status["Engine"] === null;
	}

	/** Check if table supports foreign keys
	* @param TableStatus $table_status
	*/
	function fk_support($table_status) {
		return preg_match('~InnoDB|IBMDB2I' . (min_version(5.6) ? '|NDB' : '') . '~i', $table_status["Engine"]);
	}

	/** Get information about fields
	* @return Field[]
	*/
	function fields($table) {
		$maria = (connection()->flavor == 'maria');
		$return = array();
		foreach (get_rows("SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = " . q($table) . " ORDER BY ORDINAL_POSITION") as $row) {
			$field = $row["COLUMN_NAME"];
			$type = $row["COLUMN_TYPE"];
			$generation = $row["GENERATION_EXPRESSION"];
			$extra = $row["EXTRA"];
			// https://mariadb.com/kb/en/library/show-columns/, https://github.com/vrana/adminer/pull/359#pullrequestreview-276677186
			preg_match('~^(VIRTUAL|PERSISTENT|STORED)~', $extra, $generated);
			preg_match('~^([^( ]+)(?:\((.+)\))?( unsigned)?( zerofill)?$~', $type, $match_type);
			$default = $row["COLUMN_DEFAULT"];
			if ($default != "") {
				$is_text = preg_match('~text|json~', $match_type[1]);
				if (!$maria && $is_text) {
					// default value a'b of text column is stored as _utf8mb4\'a\\\'b\' in MySQL
					$default = preg_replace("~^(_\w+)?('.*')$~", '\2', stripslashes($default));
				}
				if ($maria || $is_text) {
					$default = ($default == "NULL" ? null : preg_replace_callback("~^'(.*)'$~", function ($match) {
						return stripslashes(str_replace("''", "'", $match[1]));
					}, $default));
				}
				if (!$maria && preg_match('~binary~', $match_type[1]) && preg_match('~^0x(\w*)$~', $default, $match)) {
					$default = pack("H*", $match[1]);
				}
			}
			$return[$field] = array(
				"field" => $field,
				"full_type" => $type,
				"type" => $match_type[1],
				"length" => $match_type[2],
				"unsigned" => ltrim($match_type[3] . $match_type[4]),
				"default" => ($generated
					? ($maria ? $generation : stripslashes($generation))
					: $default
				),
				"null" => ($row["IS_NULLABLE"] == "YES"),
				"auto_increment" => ($extra == "auto_increment"),
				"on_update" => (preg_match('~\bon update (\w+)~i', $extra, $match) ? $match[1] : ""), //! available since MySQL 5.1.23
				"collation" => $row["COLLATION_NAME"],
				"privileges" => array_flip(explode(",", "$row[PRIVILEGES],where,order")),
				"comment" => $row["COLUMN_COMMENT"],
				"primary" => ($row["COLUMN_KEY"] == "PRI"),
				"generated" => ($generated[1] == "PERSISTENT" ? "STORED" : $generated[1]),
			);
		}
		return $return;
	}

	/** Get table indexes
	* @return Index[]
	*/
	function indexes($table, $connection2 = null) {
		$return = array();
		foreach (get_rows("SHOW INDEX FROM " . table($table), $connection2) as $row) {
			$name = $row["Key_name"];
			$return[$name]["type"] = ($name == "PRIMARY" ? "PRIMARY" : ($row["Index_type"] == "FULLTEXT" ? "FULLTEXT" : ($row["Non_unique"] ? ($row["Index_type"] == "SPATIAL" ? "SPATIAL" : "INDEX") : "UNIQUE")));
			$return[$name]["columns"][] = $row["Column_name"];
			$return[$name]["lengths"][] = ($row["Index_type"] == "SPATIAL" ? null : $row["Sub_part"]);
			$return[$name]["descs"][] = null;
			$return[$name]["algorithm"] = $row["Index_type"];
		}
		return $return;
	}

	/** Get foreign keys in table
	* @return ForeignKey[]
	*/
	function foreign_keys($table) {
		static $pattern = '(?:`(?:[^`]|``)+`|"(?:[^"]|"")+")';
		$return = array();
		$create_table = get_val("SHOW CREATE TABLE " . table($table), 1);
		if ($create_table) {
			preg_match_all(
				"~CONSTRAINT ($pattern) FOREIGN KEY ?\\(((?:$pattern,? ?)+)\\) REFERENCES ($pattern)(?:\\.($pattern))? \\(((?:$pattern,? ?)+)\\)(?: ON DELETE (" . driver()->onActions . "))?(?: ON UPDATE (" . driver()->onActions . "))?~",
				$create_table,
				$matches,
				PREG_SET_ORDER
			);
			foreach ($matches as $match) {
				preg_match_all("~$pattern~", $match[2], $source);
				preg_match_all("~$pattern~", $match[5], $target);
				$return[idf_unescape($match[1])] = array(
					"db" => idf_unescape($match[4] != "" ? $match[3] : $match[4]),
					"table" => idf_unescape($match[4] != "" ? $match[4] : $match[3]),
					"source" => array_map('Adminer\idf_unescape', $source[0]),
					"target" => array_map('Adminer\idf_unescape', $target[0]),
					"on_delete" => ($match[6] ?: "RESTRICT"),
					"on_update" => ($match[7] ?: "RESTRICT"),
				);
			}
		}
		return $return;
	}

	/** Get view SELECT
	* @return array{select:string}
	*/
	function view($name) {
		return array("select" => preg_replace('~^(?:[^`]|`[^`]*`)*\s+AS\s+~isU', '', get_val("SHOW CREATE VIEW " . table($name), 1)));
	}

	/** Get sorted grouped list of collations
	* @return string[][]
	*/
	function collations() {
		$return = array();
		foreach (get_rows("SHOW COLLATION") as $row) {
			if ($row["Default"]) {
				$return[$row["Charset"]][-1] = $row["Collation"];
			} else {
				$return[$row["Charset"]][] = $row["Collation"];
			}
		}
		ksort($return);
		foreach ($return as $key => $val) {
			sort($return[$key]);
		}
		return $return;
	}

	/** Find out if database is information_schema */
	function information_schema($db) {
		return ($db == "information_schema")
			|| (min_version(5.5) && $db == "performance_schema");
	}

	/** Get escaped error message */
	function error() {
		return h(preg_replace('~^You have an error.*syntax to use~U', "Syntax error", connection()->error));
	}

	/** Create database
	* @return Result
	*/
	function create_database($db, $collation) {
		return queries("CREATE DATABASE " . idf_escape($db) . ($collation ? " COLLATE " . q($collation) : ""));
	}

	/** Drop databases
	* @param list<string> $databases
	*/
	function drop_databases($databases) {
		$return = apply_queries("DROP DATABASE", $databases, 'Adminer\idf_escape');
		restart_session();
		set_session("dbs", null);
		return $return;
	}

	/** Rename database from DB
	* @param string $name new name
	*/
	function rename_database($name, $collation) {
		$return = false;
		if (create_database($name, $collation)) {
			$tables = array();
			$views = array();
			foreach (tables_list() as $table => $type) {
				if ($type == 'VIEW') {
					$views[] = $table;
				} else {
					$tables[] = $table;
				}
			}
			$return = (!$tables && !$views) || move_tables($tables, $views, $name);
			drop_databases($return ? array(DB) : array());
		}
		return $return;
	}

	/** Generate modifier for auto increment column */
	function auto_increment() {
		$auto_increment_index = " PRIMARY KEY";
		// don't overwrite primary key by auto_increment
		if ($_GET["create"] != "" && $_POST["auto_increment_col"]) {
			foreach (indexes($_GET["create"]) as $index) {
				if (in_array($_POST["fields"][$_POST["auto_increment_col"]]["orig"], $index["columns"], true)) {
					$auto_increment_index = "";
					break;
				}
				if ($index["type"] == "PRIMARY") {
					$auto_increment_index = " UNIQUE";
				}
			}
		}
		return " AUTO_INCREMENT$auto_increment_index";
	}

	/** Run commands to create or alter table
	* @param string $table "" to create
	* @param string $name new name
	* @param list<array{string, list<string>, string}> $fields of [$orig, $process_field, $after]
	* @param string[] $foreign
	* @param numeric-string|'' $auto_increment
	* @param ?Partitions $partitioning null means remove partitioning
	* @return Result|bool
	*/
	function alter_table($table, $name, $fields, $foreign, $comment, $engine, $collation, $auto_increment, $partitioning) {
		$alter = array();
		foreach ($fields as $field) {
			if ($field[1]) {
				$default = $field[1][3];
				if (preg_match('~ GENERATED~', $default)) {
					// swap default and null
					$field[1][3] = (connection()->flavor == 'maria' ? "" : $field[1][2]); // MariaDB doesn't support NULL on virtual columns
					$field[1][2] = $default;
				}
				$alter[] = ($table != "" ? ($field[0] != "" ? "CHANGE " . idf_escape($field[0]) : "ADD") : " ") . " " . implode($field[1]) . ($table != "" ? $field[2] : "");
			} else {
				$alter[] = "DROP " . idf_escape($field[0]);
			}
		}
		$alter = array_merge($alter, $foreign);
		$status = ($comment !== null ? " COMMENT=" . q($comment) : "")
			. ($engine ? " ENGINE=" . q($engine) : "")
			. ($collation ? " COLLATE " . q($collation) : "")
			. ($auto_increment != "" ? " AUTO_INCREMENT=$auto_increment" : "")
		;

		if ($partitioning) {
			$partitions = array();
			if ($partitioning["partition_by"] == 'RANGE' || $partitioning["partition_by"] == 'LIST') {
				foreach ($partitioning["partition_names"] as $key => $val) {
					$value = $partitioning["partition_values"][$key];
					$partitions[] = "\n  PARTITION " . idf_escape($val) . " VALUES " . ($partitioning["partition_by"] == 'RANGE' ? "LESS THAN" : "IN") . ($value != "" ? " ($value)" : " MAXVALUE"); //! SQL injection
				}
			}
			// $partitioning["partition"] can be expression, not only column
			$status .= "\nPARTITION BY $partitioning[partition_by]($partitioning[partition])";
			if ($partitions) {
				$status .= " (" . implode(",", $partitions) . "\n)";
			} elseif ($partitioning["partitions"]) {
				$status .= " PARTITIONS " . (+$partitioning["partitions"]);
			}
		} elseif ($partitioning === null) {
			$status .= "\nREMOVE PARTITIONING";
		}

		if ($table == "") {
			return queries("CREATE TABLE " . table($name) . " (\n" . implode(",\n", $alter) . "\n)$status");
		}
		if ($table != $name) {
			$alter[] = "RENAME TO " . table($name);
		}
		if ($status) {
			$alter[] = ltrim($status);
		}
		return ($alter ? queries("ALTER TABLE " . table($table) . "\n" . implode(",\n", $alter)) : true);
	}

	/** Run commands to alter indexes
	* @param string $table escaped table name
	* @param list<array{string, string, 'DROP'|list<string>, 3?: string, 4?: string}> $alter of ["index type", "name", ["column definition", ...], "algorithm", "condition"] or ["index type", "name", "DROP"]
	* @return Result|bool
	*/
	function alter_indexes($table, $alter) {
		$changes = array();
		foreach ($alter as $val) {
			$changes[] = ($val[2] == "DROP"
				? "\nDROP INDEX " . idf_escape($val[1])
				: "\nADD $val[0] " . ($val[0] == "PRIMARY" ? "KEY " : "") . ($val[1] != "" ? idf_escape($val[1]) . " " : "") . "(" . implode(", ", $val[2]) . ")"
			);
		}
		return queries("ALTER TABLE " . table($table) . implode(",", $changes));
	}

	/** Run commands to truncate tables
	* @param list<string> $tables
	*/
	function truncate_tables($tables) {
		return apply_queries("TRUNCATE TABLE", $tables);
	}

	/** Drop views
	* @param list<string> $views
	* @return Result|bool
	*/
	function drop_views($views) {
		return queries("DROP VIEW " . implode(", ", array_map('Adminer\table', $views)));
	}

	/** Drop tables
	* @param list<string> $tables
	* @return Result|bool
	*/
	function drop_tables($tables) {
		return queries("DROP TABLE " . implode(", ", array_map('Adminer\table', $tables)));
	}

	/** Move tables to other schema
	* @param list<string> $tables
	* @param list<string> $views
	*/
	function move_tables($tables, $views, $target) {
		$rename = array();
		foreach ($tables as $table) {
			$rename[] = table($table) . " TO " . idf_escape($target) . "." . table($table);
		}
		if (!$rename || queries("RENAME TABLE " . implode(", ", $rename))) {
			$definitions = array();
			foreach ($views as $table) {
				$definitions[table($table)] = view($table);
			}
			connection()->select_db($target);
			$db = idf_escape(DB);
			foreach ($definitions as $name => $view) {
				if (!queries("CREATE VIEW $name AS " . str_replace(" $db.", " ", $view["select"])) || !queries("DROP VIEW $db.$name")) {
					return false;
				}
			}
			return true;
		}
		//! move triggers
		return false;
	}

	/** Copy tables to other schema
	* @param list<string> $tables
	* @param list<string> $views
	*/
	function copy_tables($tables, $views, $target) {
		queries("SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");
		foreach ($tables as $table) {
			$name = ($target == DB ? table("copy_$table") : idf_escape($target) . "." . table($table));
			if (
				($_POST["overwrite"] && !queries("\nDROP TABLE IF EXISTS $name"))
				|| !queries("CREATE TABLE $name LIKE " . table($table))
				|| !queries("INSERT INTO $name SELECT * FROM " . table($table))
			) {
				return false;
			}
			foreach (get_rows("SHOW TRIGGERS LIKE " . q(addcslashes($table, "%_\\"))) as $row) {
				$trigger = $row["Trigger"];
				if (!queries("CREATE TRIGGER " . ($target == DB ? idf_escape("copy_$trigger") : idf_escape($target) . "." . idf_escape($trigger)) . " $row[Timing] $row[Event] ON $name FOR EACH ROW\n$row[Statement];")) {
					return false;
				}
			}
		}
		foreach ($views as $table) {
			$name = ($target == DB ? table("copy_$table") : idf_escape($target) . "." . table($table));
			$view = view($table);
			if (
				($_POST["overwrite"] && !queries("DROP VIEW IF EXISTS $name"))
				|| !queries("CREATE VIEW $name AS $view[select]") //! USE to avoid db.table
			) {
				return false;
			}
		}
		return true;
	}

	/** Get information about trigger
	* @param string $name trigger name
	* @return Trigger
	*/
	function trigger($name, $table) {
		if ($name == "") {
			return array();
		}
		$rows = get_rows("SHOW TRIGGERS WHERE `Trigger` = " . q($name));
		return reset($rows);
	}

	/** Get defined triggers
	* @return array{string, string}[]
	*/
	function triggers($table) {
		$return = array();
		foreach (get_rows("SHOW TRIGGERS LIKE " . q(addcslashes($table, "%_\\"))) as $row) {
			$return[$row["Trigger"]] = array($row["Timing"], $row["Event"]);
		}
		return $return;
	}

	/** Get trigger options
	* @return array{Timing: list<string>, Event: list<string>, Type: list<string>}
	*/
	function trigger_options() {
		return array(
			"Timing" => array("BEFORE", "AFTER"),
			"Event" => array("INSERT", "UPDATE", "DELETE"),
			"Type" => array("FOR EACH ROW"),
		);
	}

	/** Get information about stored routine
	* @param 'FUNCTION'|'PROCEDURE' $type
	* @return Routine
	*/
	function routine($name, $type) {
		$aliases = array("bool", "boolean", "integer", "double precision", "real", "dec", "numeric", "fixed", "national char", "national varchar");
		$space = "(?:\\s|/\\*[\s\S]*?\\*/|(?:#|-- )[^\n]*\n?|--\r?\n)";
		$enum = driver()->enumLength;
		$type_pattern = "((" . implode("|", array_merge(array_keys(driver()->types()), $aliases)) . ")\\b(?:\\s*\\(((?:[^'\")]|$enum)++)\\))?"
			. "\\s*(zerofill\\s*)?(unsigned(?:\\s+zerofill)?)?)(?:\\s*(?:CHARSET|CHARACTER\\s+SET)\\s*['\"]?([^'\"\\s,]+)['\"]?)?(?:\\s*COLLATE\\s*['\"]?([^'\"\\s,]+)['\"]?)?"; //! store COLLATE
		$pattern = "$space*(" . ($type == "FUNCTION" ? "" : driver()->inout) . ")?\\s*(?:`((?:[^`]|``)*)`\\s*|\\b(\\S+)\\s+)$type_pattern";
		$create = get_val("SHOW CREATE $type " . idf_escape($name), 2);
		preg_match("~\\(((?:$pattern\\s*,?)*)\\)\\s*" . ($type == "FUNCTION" ? "RETURNS\\s+$type_pattern\\s+" : "") . "(.*)~is", $create, $match);
		$fields = array();
		preg_match_all("~$pattern\\s*,?~is", $match[1], $matches, PREG_SET_ORDER);
		foreach ($matches as $param) {
			$fields[] = array(
				"field" => str_replace("``", "`", $param[2]) . $param[3],
				"type" => strtolower($param[5]),
				"length" => preg_replace_callback("~$enum~s", 'Adminer\normalize_enum', $param[6]),
				"unsigned" => strtolower(preg_replace('~\s+~', ' ', trim("$param[8] $param[7]"))),
				"null" => true,
				"full_type" => $param[4],
				"inout" => strtoupper($param[1]),
				"collation" => strtolower($param[9]),
			);
		}
		return array(
			"fields" => $fields,
			"comment" => get_val("SELECT ROUTINE_COMMENT FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = " . q($name)),
		) + ($type != "FUNCTION" ? array("definition" => $match[11]) : array(
			"returns" => array("type" => $match[12], "length" => $match[13], "unsigned" => $match[15], "collation" => $match[16]),
			"definition" => $match[17],
			"language" => "SQL", // available in information_schema.ROUTINES.BODY_STYLE
		));
	}

	/** Get list of routines
	* @return list<string[]> ["SPECIFIC_NAME" => , "ROUTINE_NAME" => , "ROUTINE_TYPE" => , "DTD_IDENTIFIER" => ]
	*/
	function routines() {
		return get_rows("SELECT SPECIFIC_NAME, ROUTINE_NAME, ROUTINE_TYPE, DTD_IDENTIFIER FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()");
	}

	/** Get list of available routine languages
	* @return list<string>
	*/
	function routine_languages() {
		return array(); // "SQL" not required
	}

	/** Get routine signature
	* @param Routine $row
	*/
	function routine_id($name, $row) {
		return idf_escape($name);
	}

	/** Get last auto increment ID
	* @param Result|bool $result
	*/
	function last_id($result) {
		return get_val("SELECT LAST_INSERT_ID()"); // mysql_insert_id() truncates bigint
	}

	/** Explain select
	* @return Result
	*/
	function explain($connection, $query) {
		return $connection->query("EXPLAIN " . (min_version(5.1) && !min_version(5.7) ? "PARTITIONS " : "") . $query);
	}

	/** Get approximate number of rows
	* @param TableStatus $table_status
	* @param list<string> $where
	* @return numeric-string|null null if approximate number can't be retrieved
	*/
	function found_rows($table_status, $where) {
		return ($where || $table_status["Engine"] != "InnoDB" ? null : $table_status["Rows"]);
	}

	/** Get SQL command to create table */
	function create_sql($table, $auto_increment, $style) {
		$return = get_val("SHOW CREATE TABLE " . table($table), 1);
		if (!$auto_increment) {
			$return = preg_replace('~ AUTO_INCREMENT=\d+~', '', $return); //! skip comments
		}
		return $return;
	}

	/** Get SQL command to truncate table */
	function truncate_sql($table) {
		return "TRUNCATE " . table($table);
	}

	/** Get SQL command to change database */
	function use_sql($database, $style = "") {
		$name = idf_escape($database);
		$return = "";
		if (preg_match('~CREATE~', $style) && ($create = get_val("SHOW CREATE DATABASE $name", 1))) {
			set_utf8mb4($create);
			if ($style == "DROP+CREATE") {
				$return = "DROP DATABASE IF EXISTS $name;\n";
			}
			$return .= "$create;\n";
		}
		return $return . "USE $name";
	}

	/** Get SQL commands to create triggers */
	function trigger_sql($table) {
		$return = "";
		foreach (get_rows("SHOW TRIGGERS LIKE " . q(addcslashes($table, "%_\\")), null, "-- ") as $row) {
			$return .= "\nCREATE TRIGGER " . idf_escape($row["Trigger"]) . " $row[Timing] $row[Event] ON " . table($row["Table"]) . " FOR EACH ROW\n$row[Statement];;\n";
		}
		return $return;
	}

	/** Get server variables
	* @return list<string[]> [[$name, $value]]
	*/
	function show_variables() {
		return get_rows("SHOW VARIABLES");
	}

	/** Get status variables
	* @return list<string[]> [[$name, $value]]
	*/
	function show_status() {
		return get_rows("SHOW STATUS");
	}

	/** Get process list
	* @return list<string[]> [$row]
	*/
	function process_list() {
		return get_rows("SHOW FULL PROCESSLIST");
	}

	/** Convert field in select and edit
	* @param Field $field
	* @return string|void
	*/
	function convert_field($field) {
		if (preg_match("~binary~", $field["type"])) {
			return "HEX(" . idf_escape($field["field"]) . ")";
		}
		if ($field["type"] == "bit") {
			return "BIN(" . idf_escape($field["field"]) . " + 0)"; // + 0 is required outside MySQLnd
		}
		if (preg_match("~geometry|point|linestring|polygon~", $field["type"])) {
			return (min_version(8) ? "ST_" : "") . "AsWKT(" . idf_escape($field["field"]) . ")";
		}
	}

	/** Convert value in edit after applying functions back
	* @param Field $field
	* @param string $return SQL expression
	*/
	function unconvert_field($field, $return) {
		if (preg_match("~binary~", $field["type"])) {
			$return = "UNHEX($return)";
		}
		if ($field["type"] == "bit") {
			$return = "CONVERT(b$return, UNSIGNED)";
		}
		if (preg_match("~geometry|point|linestring|polygon~", $field["type"])) {
			$prefix = (min_version(8) ? "ST_" : "");
			$return = $prefix . "GeomFromText($return, $prefix" . "SRID($field[field]))";
		}
		return $return;
	}

	/** Check whether a feature is supported
	* @param literal-string $feature check|comment|columns|copy|database|descidx|drop_col|dump|event|indexes|kill|materializedview
	* |move_col|privileges|procedure|processlist|routine|scheme|sequence|sql|status|table|trigger|type|variables|view|view_trigger
	*/
	function support($feature) {
		return preg_match(
			'~^(comment|columns|copy|database|drop_col|dump|indexes|kill|privileges|move_col|procedure|processlist|routine|sql|status|table|trigger|variables|view'
				. (min_version(5.1) ? '|event' : '')
				. (min_version(8) ? '|descidx' : '')
				. (min_version('8.0.16', '10.2.1') ? '|check' : '')
				. ')$~',
			$feature
		);
	}

	/** Kill a process
	* @param numeric-string $id
	* @return Result|bool
	*/
	function kill_process($id) {
		return queries("KILL " . number($id));
	}

	/** Return query to get connection ID */
	function connection_id() {
		return "SELECT CONNECTION_ID()";
	}

	/** Get maximum number of connections
	* @return numeric-string
	*/
	function max_connections() {
		return get_val("SELECT @@max_connections");
	}

	// Not used is MySQL but checked in compile.php:

	/** Get user defined types
	* @return string[] [$id => $name]
	*/
	function types() {
		return array();
	}

	/** Get values of user defined type */
	function type_values($id) {
		return "";
	}

	/** Get existing schemas
	* @return list<string>
	*/
	function schemas() {
		return array();
	}

	/** Get current schema */
	function get_schema() {
		return "";
	}

	/** Set current schema
	*/
	function set_schema($schema, $connection2 = null) {
		return true;
	}
}
