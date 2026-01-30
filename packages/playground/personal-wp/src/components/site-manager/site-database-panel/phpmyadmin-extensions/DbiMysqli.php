<?php declare(strict_types = 1);

/**
 * A phpMyAdmin DBI extension for the MySQL-on-SQLite driver.
 *
 * This implementation is based on the original PhpMyAdmin\Dbal\DbiMysqli class.
 * It is modified to use the MySQL-on-SQLite driver instead of MySQLi extension.
 *
 * @see https://github.com/phpmyadmin/phpmyadmin/blob/962857e4f63d42e38f11ff4d63f5e722018add76/libraries/classes/Dbal/DbiMysqli.php
 * @see https://github.com/phpmyadmin/phpmyadmin/blob/142c0cf3be84c346174b730b6aa3ebcf44029256/src/Dbal/MysqliResult.php
 */

namespace PhpMyAdmin\Dbal;

use Closure;
use Exception;
use Generator;
use PDO;
use PhpMyAdmin\FieldMetadata;
use PhpMyAdmin\Query\Utilities;
use Throwable;
use WP_SQLite_Connection;
use WP_SQLite_Driver;

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

// Supress the following phpMyAdmin warning:
//   "The mysqlnd extension is missing. Please check your PHP configuration."
Closure::bind(
	function () {
		$this->errors = array_values(
			array_filter(
				$this->errors,
				function ($error) {
					$skip = (
						strpos($error->getMessage(), 'mysqlnd') !== false
						&& strpos($error->getMessage(), 'extension is missing') !== false
					);
					return !$skip;
				}
			)
		);
	},
	$GLOBALS['errorHandler'],
	$GLOBALS['errorHandler']
)();

// Ensure MySQLi type constants are defined for phpMyAdmin.
if (!defined('MYSQLI_TYPE_DECIMAL')) define('MYSQLI_TYPE_DECIMAL', 0);
if (!defined('MYSQLI_TYPE_TINY')) define('MYSQLI_TYPE_TINY', 1);
if (!defined('MYSQLI_TYPE_CHAR')) define('MYSQLI_TYPE_CHAR', 1);
if (!defined('MYSQLI_TYPE_SHORT')) define('MYSQLI_TYPE_SHORT', 2);
if (!defined('MYSQLI_TYPE_LONG')) define('MYSQLI_TYPE_LONG', 3);
if (!defined('MYSQLI_TYPE_FLOAT')) define('MYSQLI_TYPE_FLOAT', 4);
if (!defined('MYSQLI_TYPE_DOUBLE')) define('MYSQLI_TYPE_DOUBLE', 5);
if (!defined('MYSQLI_TYPE_NULL')) define('MYSQLI_TYPE_NULL', 6);
if (!defined('MYSQLI_TYPE_TIMESTAMP')) define('MYSQLI_TYPE_TIMESTAMP', 7);
if (!defined('MYSQLI_TYPE_LONGLONG')) define('MYSQLI_TYPE_LONGLONG', 8);
if (!defined('MYSQLI_TYPE_INT24')) define('MYSQLI_TYPE_INT24', 9);
if (!defined('MYSQLI_TYPE_DATE')) define('MYSQLI_TYPE_DATE', 10);
if (!defined('MYSQLI_TYPE_TIME')) define('MYSQLI_TYPE_TIME', 11);
if (!defined('MYSQLI_TYPE_DATETIME')) define('MYSQLI_TYPE_DATETIME', 12);
if (!defined('MYSQLI_TYPE_YEAR')) define('MYSQLI_TYPE_YEAR', 13);
if (!defined('MYSQLI_TYPE_NEWDATE')) define('MYSQLI_TYPE_NEWDATE', 14);
if (!defined('MYSQLI_TYPE_BIT')) define('MYSQLI_TYPE_BIT', 16);
if (!defined('MYSQLI_TYPE_VECTOR')) define('MYSQLI_TYPE_VECTOR', 242);
if (!defined('MYSQLI_TYPE_JSON')) define('MYSQLI_TYPE_JSON', 245);
if (!defined('MYSQLI_TYPE_NEWDECIMAL')) define('MYSQLI_TYPE_NEWDECIMAL', 246);
if (!defined('MYSQLI_TYPE_ENUM')) define('MYSQLI_TYPE_ENUM', 247);
if (!defined('MYSQLI_TYPE_SET')) define('MYSQLI_TYPE_SET', 248);
if (!defined('MYSQLI_TYPE_TINY_BLOB')) define('MYSQLI_TYPE_TINY_BLOB', 249);
if (!defined('MYSQLI_TYPE_MEDIUM_BLOB')) define('MYSQLI_TYPE_MEDIUM_BLOB', 250);
if (!defined('MYSQLI_TYPE_LONG_BLOB')) define('MYSQLI_TYPE_LONG_BLOB', 251);
if (!defined('MYSQLI_TYPE_BLOB')) define('MYSQLI_TYPE_BLOB', 252);
if (!defined('MYSQLI_TYPE_VAR_STRING')) define('MYSQLI_TYPE_VAR_STRING', 253);
if (!defined('MYSQLI_TYPE_STRING')) define('MYSQLI_TYPE_STRING', 243);
if (!defined('MYSQLI_TYPE_GEOMETRY')) define('MYSQLI_TYPE_GEOMETRY', 255);

// Ensure MySQLi flags constants are defined for phpMyAdmin.
if (!defined('MYSQLI_NOT_NULL_FLAG')) define('MYSQLI_NOT_NULL_FLAG', 1);
if (!defined('MYSQLI_PRI_KEY_FLAG')) define('MYSQLI_PRI_KEY_FLAG', 2);
if (!defined('MYSQLI_UNIQUE_KEY_FLAG')) define('MYSQLI_UNIQUE_KEY_FLAG', 4);
if (!defined('MYSQLI_MULTIPLE_KEY_FLAG')) define('MYSQLI_MULTIPLE_KEY_FLAG', 8);
if (!defined('MYSQLI_BLOB_FLAG')) define('MYSQLI_BLOB_FLAG', 16);
if (!defined('MYSQLI_UNSIGNED_FLAG')) define('MYSQLI_UNSIGNED_FLAG', 32);
if (!defined('MYSQLI_ZEROFILL_FLAG')) define('MYSQLI_ZEROFILL_FLAG', 64);
if (!defined('MYSQLI_BINARY_FLAG')) define('MYSQLI_BINARY_FLAG', 128);
if (!defined('MYSQLI_ENUM_FLAG')) define('MYSQLI_ENUM_FLAG', 256);
if (!defined('MYSQLI_AUTO_INCREMENT_FLAG')) define('MYSQLI_AUTO_INCREMENT_FLAG', 512);
if (!defined('MYSQLI_TIMESTAMP_FLAG')) define('MYSQLI_TIMESTAMP_FLAG', 1024);
if (!defined('MYSQLI_SET_FLAG')) define('MYSQLI_SET_FLAG', 2048);
if (!defined('MYSQLI_NO_DEFAULT_VALUE_FLAG')) define('MYSQLI_NO_DEFAULT_VALUE_FLAG', 4096);
if (!defined('MYSQLI_ON_UPDATE_NOW_FLAG')) define('MYSQLI_ON_UPDATE_NOW_FLAG', 8192);
if (!defined('MYSQLI_PART_KEY_FLAG')) define('MYSQLI_PART_KEY_FLAG', 16384);
if (!defined('MYSQLI_NUM_FLAG')) define('MYSQLI_NUM_FLAG', 32768);
if (!defined('MYSQLI_GROUP_FLAG')) define('MYSQLI_GROUP_FLAG', 32768);

/**
 * A custom result class for the MySQL-on-SQLite driver.
 *
 * This implementation is based on the original PhpMyAdmin\Dbal\MysqliResult class.
 *
 * @see https://github.com/phpmyadmin/phpmyadmin/blob/142c0cf3be84c346174b730b6aa3ebcf44029256/src/Dbal/MysqliResult.php
 */
class Result implements ResultInterface {
	/** @var array */
	private $rows = array();

	/** @var array */
	private $columns = array();

	/** @var int */
	private $row_offset = 0;

	public function __construct($rows, $columns) {
		$this->rows = array();
		if (is_array($rows)) {
			foreach ($rows as $row) {
				$this->rows[] = (array) $row;
			}
		}
		$this->columns = $columns;
	}

	public function fetchAllAssoc(): array {
		return $this->rows;
	}

	public function fetchAllColumn(): array {
		return array_column($this->rows, 0);
	}

	public function fetchAllKeyPair(): array {
		return array_combine(
			array_column($this->rows, 0),
			array_column($this->rows, 1)
		);
	}

	public function fetchAssoc(): array {
		$row = $this->rows[$this->row_offset++] ?? false;
		if ($row === false) {
			return array();
		}
		return $row;
	}

	public function fetchRow(): array {
		$row = $this->rows[$this->row_offset++] ?? false;
		if ($row === false) {
			return [];
		}
		return array_values($row);
	}

	public function fetchValue($field = 0) {
		if (is_string($field)) {
            $row = $this->fetchAssoc();
        } else {
            $row = $this->fetchRow();
        }
		return $row[$field] ?? false;
	}

	public function getFieldNames(): array {
		$names = array();
		foreach ($this->columns as $column) {
			$names[] = $column['name'];
		}
		return $names;
	}

	public function getFieldsMeta(): array {
		$meta = array();
		foreach ($this->columns as $column) {
			$flags = $column['flags'] ?? array();

			// PhpMyAdmin expects MySQLi-like column metadata rather than PDO syntax.
			// The SQLite driver provides it in "mysqli:" prefixed metadata keys.
			foreach ($column as $key => $value) {
				if (strpos($key, 'mysqli:') === 0) {
					$column[substr($key, 7)] = $value;
				}
			}

			// Convert PDO-style flags array to MySQLi-style integer bitmask.
			// TODO: Remove this when the driver implements "mysqli:flags".
			$mysqli_flags = 0;
			foreach ($flags as $flag) {
				switch ($flag) {
					case 'primary_key':
						$mysqli_flags |= \MYSQLI_PRI_KEY_FLAG;
						break;
					case 'unique_key':
						$mysqli_flags |= \MYSQLI_UNIQUE_KEY_FLAG;
						break;
					case 'not_null':
						$mysqli_flags |= \MYSQLI_NOT_NULL_FLAG;
						break;
					case 'auto_increment':
						$mysqli_flags |= \MYSQLI_AUTO_INCREMENT_FLAG;
						break;
				}
			}
			$column['flags'] = $mysqli_flags;

			$field = (object) $column;
			$meta[] = new FieldMetadata($field->type, $field->flags, $field);
		}
		return $meta;
	}

	public function getIterator(): Generator {
		$this->row_offset = 0;
		foreach ($this->rows as $row) {
			yield $row;
		}
	}

	public function numFields(): int {
		return count($this->columns);
	}

	public function numRows() {
		return count($this->rows);
	}

	public function seek(int $offset): bool {
		$this->row_offset = $offset;
		if ($this->row_offset >= count($this->rows)) {
			return false;
		}
		return true;
	}
}

/**
 * A custom DBI extension for the MySQL-on-SQLite driver.
 *
 * This implementation is based on the original PhpMyAdmin\Dbal\DbiMysqli class.
 *
 * @see https://github.com/phpmyadmin/phpmyadmin/blob/962857e4f63d42e38f11ff4d63f5e722018add76/libraries/classes/Dbal/DbiMysqli.php
 */
class DbiMysqli implements DbiExtension {
	/** @var WP_SQLite_Driver */
    private $driver;

	/** @var string */
	private $last_error_message = '';

	/** @var int */
	private $last_error_number = 0;

    public function connect($user, $password, array $server) {
		$pdo = new PDO('sqlite:/wordpress/wp-content/database/.ht.sqlite');
		$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->driver = new WP_SQLite_Driver(
			new WP_SQLite_Connection(array('pdo' => $pdo)),
			'wordpress'
		);
		return $this->driver;
    }

    public function selectDb($databaseName, $link): bool {
		$link->query(sprintf('USE %s', $link->get_connection()->quote_identifier($databaseName)));
		return true;
    }

    public function realQuery(string $query, $link, int $options) {
		try {
			$this->last_error_message = '';
			$this->last_error_number = 0;
			$result = $link->query($query);
		} catch (Throwable $e) {
			$this->last_error_message = $e->getMessage();
			$this->last_error_number = $e->getCode();
			return false;
		}
		if ($result === false) {
			return false;
		}
        return new Result($result, $link->get_last_column_meta());
    }

    public function realMultiQuery($link, $query): bool {
		return false; // Multi-query not implemented.
    }

    public function moreResults($link): bool {
		return false; // Multi-query not implemented.
    }

    public function nextResult($link): bool {
		return false; // Multi-query not implemented.
    }

    public function storeResult($link) {
		return false; // Multi-query not implemented.
    }

    public function getHostInfo($link) {
		return 'WorPress Playground connection';
    }

    public function getProtoInfo($link) {
        return 10;
    }

    public function getClientInfo() {
		return 'mysql-on-sqlite 8.0.38';
    }

    public function getError($link): string
    {
		$error_number = $this->last_error_number;
		$error_message = $this->last_error_message;
		$GLOBALS['errno'] = $error_number;
		if ($error_number === 0 || $error_message === '') {
			return '';
		}
		return Utilities::formatError($error_number, $error_message);
    }

    public function affectedRows($link) {
		$value = $link->get_last_return_value();
		return is_int($value) ? $value : 0;
    }

    public function escapeString($link, $string) {
		// For some reason, using "$link->get_connection()->quote($string)"
		// causes the strings to be double-quoted. Let's skip the quoting.
		return $string;
    }

    public function prepare($link, string $query) {
        throw new Exception('Not implemented');
    }
}
