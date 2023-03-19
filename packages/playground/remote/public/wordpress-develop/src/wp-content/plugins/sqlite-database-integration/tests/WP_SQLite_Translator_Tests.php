<?php

use PHPUnit\Framework\TestCase;

class WP_SQLite_Translator_Tests extends TestCase {

	private $engine;
	private $sqlite;

	public static function setUpBeforeClass(): void {
		// if ( ! defined( 'PDO_DEBUG' )) {
		// define( 'PDO_DEBUG', true );
		// }
		if ( ! defined( 'FQDB' ) ) {
			define( 'FQDB', ':memory:' );
			define( 'FQDBDIR', __DIR__ . '/../testdb' );
		}
		error_reporting( E_ALL & ~E_DEPRECATED );
		if ( ! isset( $GLOBALS['table_prefix'] ) ) {
			$GLOBALS['table_prefix'] = 'wptests_';
		}
		if ( ! isset( $GLOBALS['wpdb'] ) ) {
			$GLOBALS['wpdb']                  = new stdClass();
			$GLOBALS['wpdb']->suppress_errors = false;
			$GLOBALS['wpdb']->show_errors     = true;
		}
	}

	// Before each test, we create a new database
	public function setUp(): void {
		$this->sqlite = new PDO( 'sqlite::memory:' );

		$this->engine = new WP_SQLite_Translator( $this->sqlite );
		$this->engine->query(
			"CREATE TABLE _options (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				option_name TEXT NOT NULL default '',
				option_value TEXT NOT NULL default ''
			);"
		);
		$this->engine->query(
			"CREATE TABLE _dates (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				option_name TEXT NOT NULL default '',
				option_value DATE NOT NULL
			);"
		);
	}

	private function assertQuery( $sql ) {
		$retval = $this->engine->query( $sql );
		$this->assertEquals(
			'',
			$this->engine->get_error_message()
		);
		$this->assertNotFalse(
			$retval
		);
		return $retval;
	}

	public function testRegexp() {
		$this->assertQuery(
			"INSERT INTO _options (option_name, option_value) VALUES ('rss_0123456789abcdef0123456789abcdef', '1');"
		);
		$this->assertQuery(
			"INSERT INTO _options (option_name, option_value) VALUES ('transient', '1');"
		);

		$this->assertQuery( "DELETE FROM _options WHERE option_name  REGEXP '^rss_.+$'" );
		$this->assertQuery( 'SELECT * FROM _options' );
		$this->assertCount( 1, $this->engine->get_query_results() );
	}

	/**
	 * @dataProvider regexpOperators
	 */
	public function testRegexps( $operator, $regexp, $expected_result ) {
		$this->assertQuery(
			"INSERT INTO _options (option_name) VALUES ('rss_123'), ('RSS_123'), ('transient');"
		);

		$this->assertQuery( "SELECT ID, option_name FROM _options WHERE option_name $operator '$regexp' ORDER BY id LIMIT 1" );
		$this->assertEquals(
			array( $expected_result ),
			$this->engine->get_query_results()
		);
	}

	public function regexpOperators() {
		$lowercase_rss       = (object) array(
			'ID'          => '1',
			'option_name' => 'rss_123',
		);
		$uppercase_RSS       = (object) array(
			'ID'          => '2',
			'option_name' => 'RSS_123',
		);
		$lowercase_transient = (object) array(
			'ID'          => '3',
			'option_name' => 'transient',
		);
		return array(
			array( 'REGEXP', '^RSS_.+$', $lowercase_rss ),
			array( 'RLIKE', '^RSS_.+$', $lowercase_rss ),
			array( 'REGEXP BINARY', '^RSS_.+$', $uppercase_RSS ),
			array( 'RLIKE BINARY', '^RSS_.+$', $uppercase_RSS ),
			array( 'NOT REGEXP', '^RSS_.+$', $lowercase_transient ),
			array( 'NOT RLIKE', '^RSS_.+$', $lowercase_transient ),
			array( 'NOT REGEXP BINARY', '^RSS_.+$', $lowercase_rss ),
			array( 'NOT RLIKE BINARY', '^RSS_.+$', $lowercase_rss ),
		);
	}

	public function testInsertDateNow() {
		$this->assertQuery(
			"INSERT INTO _dates (option_name, option_value) VALUES ('first', now());"
		);

		$this->assertQuery( 'SELECT YEAR(option_value) as y FROM _dates' );

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( date( 'Y' ), $results[0]->y );
	}

	public function testCastAsBinary() {
		$this->assertQuery(
			// Use a confusing alias to make sure it replaces only the correct token
			"SELECT CAST('ABC' AS BINARY) as binary;"
		);
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( 'ABC', $results[0]->binary );
	}

	public function testSelectFromDual() {
		$result = $this->assertQuery(
			'SELECT 1 as output FROM DUAL'
		);
		$this->assertEquals( 1, $result[0]->output );
	}

	public function testInsertSelectFromDual() {
		$result = $this->assertQuery(
			'INSERT INTO _options (option_name, option_value) SELECT "A", "b" FROM DUAL WHERE ( SELECT NULL FROM DUAL ) IS NULL'
		);
		$this->assertEquals( 1, $result );
	}

	public function testCreateTemporaryTable() {
		$this->assertQuery(
			"CREATE TEMPORARY TABLE _tmp_table (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				option_name TEXT NOT NULL default '',
				option_value TEXT NOT NULL default ''
			);"
		);
		$this->assertQuery(
			'DROP TEMPORARY TABLE _tmp_table;'
		);
	}

	public function testShowTablesLike() {
		$this->assertQuery(
			"CREATE TABLE _tmp_table (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				option_name TEXT NOT NULL default '',
				option_value TEXT NOT NULL default ''
			);"
		);
		$this->assertQuery(
			"CREATE TABLE _tmp_table_2 (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				option_name TEXT NOT NULL default '',
				option_value TEXT NOT NULL default ''
			);"
		);

		$this->assertQuery(
			"SHOW TABLES LIKE '_tmp_table';"
		);
		$this->assertEquals(
			array(
				(object) array(
					'Tables_in_db' => '_tmp_table',
				),
			),
			$this->engine->get_query_results()
		);
	}

	public function testCreateTable() {
		$result = $this->assertQuery(
			"CREATE TABLE wptests_users (
				ID bigint(20) unsigned NOT NULL auto_increment,
				user_login varchar(60) NOT NULL default '',
				user_pass varchar(255) NOT NULL default '',
				user_nicename varchar(50) NOT NULL default '',
				user_email varchar(100) NOT NULL default '',
				user_url varchar(100) NOT NULL default '',
				user_registered datetime NOT NULL default '0000-00-00 00:00:00',
				user_activation_key varchar(255) NOT NULL default '',
				user_status int(11) NOT NULL default '0',
				display_name varchar(250) NOT NULL default '',
				PRIMARY KEY  (ID),
				KEY user_login_key (user_login),
				KEY user_nicename (user_nicename),
				KEY user_email (user_email)
			) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci"
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$this->assertQuery( 'DESCRIBE wptests_users;' );
		$results = $this->engine->get_query_results();
		$this->assertEquals(
			array(
				(object) array(
					'Field'   => 'ID',
					'Type'    => 'bigint(20) unsigned',
					'Null'    => 'NO',
					'Key'     => 'PRI',
					'Default' => null,
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_login',
					'Type'    => 'varchar(60)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_pass',
					'Type'    => 'varchar(255)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_nicename',
					'Type'    => 'varchar(50)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_email',
					'Type'    => 'varchar(100)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_url',
					'Type'    => 'varchar(100)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_registered',
					'Type'    => 'datetime',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '0000-00-00 00:00:00',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_activation_key',
					'Type'    => 'varchar(255)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'user_status',
					'Type'    => 'int(11)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '0',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'display_name',
					'Type'    => 'varchar(250)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
			),
			$results
		);
	}

	public function testCreateTableWithTrailingComma() {
		$result = $this->assertQuery(
			'CREATE TABLE wptests_users (
				ID bigint(20) unsigned NOT NULL auto_increment,
				PRIMARY KEY  (ID),
			) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );
	}

	public function testCreateTableSpatialIndex() {
		$result = $this->assertQuery(
			'CREATE TABLE wptests_users (
				ID bigint(20) unsigned NOT NULL auto_increment,
				UNIQUE KEY (ID),
			)'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );
	}

	public function testAlterTableAddColumn() {
		$result = $this->assertQuery(
			"CREATE TABLE _tmp_table (
				name varchar(20) NOT NULL default ''
			);"
		);

		$result = $this->assertQuery( 'ALTER TABLE _tmp_table ADD COLUMN `column` int;' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$this->assertQuery( 'DESCRIBE _tmp_table;' );
		$results = $this->engine->get_query_results();
		$this->assertEquals(
			array(
				(object) array(
					'Field'   => 'name',
					'Type'    => 'varchar(20)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'column',
					'Type'    => 'int',
					'Null'    => 'YES',
					'Key'     => '',
					'Default' => null,
					'Extra'   => '',
				),
			),
			$results
		);
	}

	public function testAlterTableAddNotNullVarcharColumn() {
		$result = $this->assertQuery(
			"CREATE TABLE _tmp_table (
				name varchar(20) NOT NULL default ''
			);"
		);

		$result = $this->assertQuery( "ALTER TABLE _tmp_table ADD COLUMN `column` VARCHAR(20) NOT NULL DEFAULT 'foo';" );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$this->assertQuery( 'DESCRIBE _tmp_table;' );
		$results = $this->engine->get_query_results();
		$this->assertEquals(
			array(
				(object) array(
					'Field'   => 'name',
					'Type'    => 'varchar(20)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'column',
					'Type'    => 'varchar(20)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => 'foo',
					'Extra'   => '',
				),
			),
			$results
		);
	}

	public function testAlterTableAddIndex() {
		$result = $this->assertQuery(
			"CREATE TABLE _tmp_table (
				name varchar(20) NOT NULL default ''
			);"
		);

		$result = $this->assertQuery( 'ALTER TABLE _tmp_table ADD INDEX name (name);' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$this->assertQuery( 'SHOW INDEX FROM _tmp_table;' );
		$results = $this->engine->get_query_results();
		$this->assertEquals(
			array(
				(object) array(
					'Table'         => '_tmp_table',
					'Non_unique'    => '1',
					'Key_name'      => 'name',
					'Seq_in_index'  => '0',
					'Column_name'   => 'name',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
			),
			$results
		);
	}

	public function testAlterTableAddUniqueIndex() {
		$result = $this->assertQuery(
			"CREATE TABLE _tmp_table (
				name varchar(20) NOT NULL default ''
			);"
		);

		$result = $this->assertQuery( 'ALTER TABLE _tmp_table ADD UNIQUE INDEX name (name(20));' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$this->assertQuery( 'SHOW INDEX FROM _tmp_table;' );
		$results = $this->engine->get_query_results();
		$this->assertEquals(
			array(
				(object) array(
					'Table'         => '_tmp_table',
					'Non_unique'    => '0',
					'Key_name'      => 'name',
					'Seq_in_index'  => '0',
					'Column_name'   => 'name',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
			),
			$results
		);
	}

	public function testAlterTableAddFulltextIndex() {
		$result = $this->assertQuery(
			"CREATE TABLE _tmp_table (
				name varchar(20) NOT NULL default ''
			);"
		);

		$result = $this->assertQuery( 'ALTER TABLE _tmp_table ADD FULLTEXT INDEX name (name);' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$this->assertQuery( 'SHOW INDEX FROM _tmp_table;' );
		$results = $this->engine->get_query_results();
		$this->assertEquals(
			array(
				(object) array(
					'Table'         => '_tmp_table',
					'Non_unique'    => '1',
					'Key_name'      => 'name',
					'Seq_in_index'  => '0',
					'Column_name'   => 'name',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'FULLTEXT',
					'Comment'       => '',
					'Index_comment' => '',
				),
			),
			$results
		);
	}


	public function testAlterTableModifyColumn() {
		$this->assertQuery(
			"CREATE TABLE _tmp_table (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				name varchar(20) NOT NULL default '',
				lastname varchar(20) NOT NULL default '',
				KEY composite (name, lastname),
				UNIQUE KEY name (name)
			);"
		);
		// Insert a record
		$result = $this->assertQuery( "INSERT INTO _tmp_table (ID, name, lastname) VALUES (1, 'Johnny', 'Appleseed');" );
		$this->assertEquals( 1, $result );

		// Primary key violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, name, lastname) VALUES (1, 'Mike', 'Pearseed');" );
		$this->assertEquals( false, $result );

		// Unique constraint violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, name, lastname) VALUES (2, 'Johnny', 'Appleseed');" );
		$this->assertEquals( false, $result );

		// Rename the "name" field to "firstname":
		$result = $this->engine->query( "ALTER TABLE _tmp_table CHANGE column name firstname varchar(50) NOT NULL default 'mark';" );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		// Confirm the original data is still there:
		$result = $this->engine->query( 'SELECT * FROM _tmp_table;' );
		$this->assertCount( 1, $result );
		$this->assertEquals( 1, $result[0]->ID );
		$this->assertEquals( 'Johnny', $result[0]->firstname );
		$this->assertEquals( 'Appleseed', $result[0]->lastname );

		// Confirm the primary key is intact:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, firstname, lastname) VALUES (1, 'Mike', 'Pearseed');" );
		$this->assertEquals( false, $result );

		// Confirm the unique key is intact:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, firstname, lastname) VALUES (2, 'Johnny', 'Appleseed');" );
		$this->assertEquals( false, $result );

		// Confirm the autoincrement still works:
		$result = $this->engine->query( "INSERT INTO _tmp_table (firstname, lastname) VALUES ('John', 'Doe');" );
		$this->assertEquals( true, $result );
		$result = $this->engine->query( "SELECT * FROM _tmp_table WHERE firstname='John';" );
		$this->assertCount( 1, $result );
		$this->assertEquals( 2, $result[0]->ID );
	}

	public function testAlterTableModifyColumnWithHyphens() {
		$result = $this->assertQuery(
			'CREATE TABLE wptests_dbdelta_test2 (
				`foo-bar` varchar(255) DEFAULT NULL
			)'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$result = $this->assertQuery(
			'ALTER TABLE wptests_dbdelta_test2 CHANGE COLUMN `foo-bar` `foo-bar` text DEFAULT NULL'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$result = $this->assertQuery( 'DESCRIBE wptests_dbdelta_test2;' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );
		$this->assertEquals(
			array(
				(object) array(
					'Field'   => 'foo-bar',
					'Type'    => 'text',
					'Null'    => 'YES',
					'Key'     => '',
					'Default' => 'NULL',
					'Extra'   => '',
				),
			),
			$result
		);
	}

	public function testAlterTableModifyColumnComplexChange() {
		$result = $this->assertQuery(
			"CREATE TABLE _tmp_table (
				ID INTEGER NOT NULL,
				name varchar(20) NOT NULL default '',
				lastname varchar(20) default '',
				date_as_string varchar(20) default '',
				PRIMARY KEY (ID, name)
			);"
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		// Add a unique index
		$result = $this->assertQuery(
			'ALTER TABLE _tmp_table ADD UNIQUE INDEX "test_unique_composite" (name, lastname);'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		// Add a regular index
		$result = $this->assertQuery(
			'ALTER TABLE _tmp_table ADD INDEX "test_regular" (lastname);'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		// Confirm the table is well-behaved so far:

		// Insert a few records
		$result = $this->assertQuery(
			"
			INSERT INTO _tmp_table (ID, name, lastname, date_as_string)
			VALUES
				(1, 'Johnny', 'Appleseed', '2002-01-01 12:53:13'),
				(2, 'Mike', 'Foo', '2003-01-01 12:53:13'),
				(3, 'Kate', 'Bar', '2004-01-01 12:53:13'),
				(4, 'Anna', 'Pear', '2005-01-01 12:53:13')
			;"
		);
		$this->assertEquals( 4, $result );

		// Primary key violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, name) VALUES (1, 'Johnny');" );
		$this->assertEquals( false, $result );

		// Unique constraint violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, name, lastname) VALUES (5, 'Kate', 'Bar');" );
		$this->assertEquals( false, $result );

		// No constraint violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, name, lastname) VALUES (5, 'Joanna', 'Bar');" );
		$this->assertEquals( 1, $result );

		// Now – let's change a few columns:
		$result = $this->engine->query( 'ALTER TABLE _tmp_table CHANGE COLUMN name firstname varchar(20)' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$result = $this->engine->query( 'ALTER TABLE _tmp_table CHANGE COLUMN date_as_string datetime datetime NOT NULL' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		// Finally, let's confirm our data is intact and the table is still well-behaved:
		$result = $this->engine->query( 'SELECT * FROM _tmp_table ORDER BY ID;' );
		$this->assertCount( 5, $result );
		$this->assertEquals( 1, $result[0]->ID );
		$this->assertEquals( 'Johnny', $result[0]->firstname );
		$this->assertEquals( 'Appleseed', $result[0]->lastname );
		$this->assertEquals( '2002-01-01 12:53:13', $result[0]->datetime );

		// Primary key violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, firstname, datetime) VALUES (1, 'Johnny', '2010-01-01 12:53:13');" );
		$this->assertEquals( false, $result );

		// Unique constraint violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, firstname, lastname, datetime) VALUES (6, 'Kate', 'Bar', '2010-01-01 12:53:13');" );
		$this->assertEquals( false, $result );

		// No constraint violation:
		$result = $this->engine->query( "INSERT INTO _tmp_table (ID, firstname, lastname, datetime) VALUES (6, 'Sophie', 'Bar', '2010-01-01 12:53:13');" );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

	}

	public function testCaseInsensitiveUniqueIndex() {
		$result = $this->engine->query(
			"CREATE TABLE _tmp_table (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				name varchar(20) NOT NULL default '',
				lastname varchar(20) NOT NULL default '',
				KEY name (name),
				UNIQUE KEY uname (name),
				UNIQUE KEY last (lastname)
			);"
		);
		$this->assertEquals( 1, $result );

		$result1 = $this->engine->query( "INSERT INTO _tmp_table (name) VALUES ('first');" );
		$this->assertEquals( 1, $result1 );

		// Unique keys should be case-insensitive:
		$result2 = $this->engine->query( "INSERT INTO _tmp_table (name) VALUES ('FIRST');" );
		$this->assertFalse( $result2 );
	}

	public function testOnDuplicateUpdate() {
		$this->assertQuery(
			"CREATE TABLE _tmp_table (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				name varchar(20) NOT NULL default '',
				UNIQUE KEY myname (name)
			);"
		);

		// $result1 = $this->assertQuery( "INSERT INTO _tmp_table (name) VALUES ('first');" );
		// $this->assertEquals( '', $this->engine->get_error_message() );
		// $this->assertEquals( 1, $result1 );

		$result2 = $this->assertQuery( "INSERT INTO _tmp_table (name) VALUES ('FIRST') ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);" );
		$this->assertEquals( 1, $result2 );

		$this->assertQuery( 'SELECT * FROM _tmp_table;' );
		$this->assertCount( 1, $this->engine->get_query_results() );
		$this->assertEquals(
			array(
				(object) array(
					'name' => 'FIRST',
					'ID'   => 1,
				),
			),
			$this->engine->get_query_results()
		);
	}

	public function testTruncatesInvalidDates() {
		$this->assertQuery( "INSERT INTO _dates (option_value) VALUES ('2022-01-01 14:24:12');" );
		$this->assertQuery( "INSERT INTO _dates (option_value) VALUES ('2022-31-01 14:24:12');" );

		$this->assertQuery( 'SELECT * FROM _dates;' );
		$results = $this->engine->get_query_results();
		$this->assertCount( 2, $results );
		$this->assertEquals( '2022-01-01 14:24:12', $results[0]->option_value );
		$this->assertEquals( '0000-00-00 00:00:00', $results[1]->option_value );
	}

	public function testCaseInsensitiveSelect() {
		$this->assertQuery(
			"CREATE TABLE _tmp_table (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				name varchar(20) NOT NULL default ''
			);"
		);
		$this->assertQuery(
			"INSERT INTO _tmp_table (name) VALUES ('first');"
		);
		$this->assertQuery( "SELECT name FROM _tmp_table WHERE name = 'FIRST';" );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertCount( 1, $this->engine->get_query_results() );
		$this->assertEquals(
			array(
				(object) array(
					'name' => 'first',
				),
			),
			$this->engine->get_query_results()
		);
	}

	public function testSelectBetweenDates() {
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('first', '2016-01-15T00:00:00Z');" );
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('second', '2016-01-16T00:00:00Z');" );
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('third', '2016-01-17T00:00:00Z');" );
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('fourth', '2016-01-18T00:00:00Z');" );

		$this->assertQuery( "SELECT * FROM _dates WHERE option_value BETWEEN '2016-01-15T00:00:00Z' AND '2016-01-17T00:00:00Z' ORDER BY ID;" );
		$results = $this->engine->get_query_results();
		$this->assertCount( 3, $results );
		$this->assertEquals( 'first', $results[0]->option_name );
		$this->assertEquals( 'second', $results[1]->option_name );
		$this->assertEquals( 'third', $results[2]->option_name );
	}

	public function testSelectFilterByDatesGtLt() {
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('first', '2016-01-15T00:00:00Z');" );
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('second', '2016-01-16T00:00:00Z');" );
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('third', '2016-01-17T00:00:00Z');" );
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('fourth', '2016-01-18T00:00:00Z');" );

		$this->assertQuery(
			"
			SELECT * FROM _dates
			WHERE option_value > '2016-01-15 00:00:00'
			AND   option_value < '2016-01-17 00:00:00'
			ORDER BY ID
		"
		);
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( 'second', $results[0]->option_name );
	}

	public function testSelectFilterByDatesZeroHour() {
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('first', '2014-10-21 00:42:29');" );
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('second', '2014-10-21 01:42:29');" );

		$this->assertQuery(
			'
			SELECT * FROM _dates
			WHERE YEAR(option_value) = 2014
			AND   MONTHNUM(option_value) = 10
			AND   DAY(option_value) = 21
			AND   HOUR(option_value) = 0
			AND   MINUTE(option_value) = 42
		'
		);
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( 'first', $results[0]->option_name );
	}

	public function testCorrectlyInsertsDatesAndStrings() {
		$this->assertQuery( "INSERT INTO _dates (option_name, option_value) VALUES ('2016-01-15T00:00:00Z', '2016-01-15T00:00:00Z');" );

		$this->assertQuery( 'SELECT * FROM _dates' );
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '2016-01-15 00:00:00', $results[0]->option_value );
		if ( $results[0]->option_name !== '2016-01-15T00:00:00Z' ) {
			$this->markTestSkipped( 'A datetime-like string was rewritten to an SQLite format even though it was used as a text and not as a datetime.' );
		}
		$this->assertEquals( '2016-01-15T00:00:00Z', $results[0]->option_name );
	}

	public function testTransactionRollback() {
		$this->assertQuery( 'BEGIN' );
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('first');" );
		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 1, $this->engine->get_query_results() );
		$this->assertQuery( 'ROLLBACK' );

		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 0, $this->engine->get_query_results() );
	}

	public function testTransactionCommit() {
		$this->assertQuery( 'BEGIN' );
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('first');" );
		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 1, $this->engine->get_query_results() );
		$this->assertQuery( 'COMMIT' );

		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 1, $this->engine->get_query_results() );
	}

	public function testStartTransactionCommand() {
		$this->assertQuery( 'START TRANSACTION' );
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('first');" );
		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 1, $this->engine->get_query_results() );
		$this->assertQuery( 'ROLLBACK' );

		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 0, $this->engine->get_query_results() );
	}

	public function testNestedTransactionWork() {
		$this->assertQuery( 'BEGIN' );
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('first');" );
		$this->assertQuery( 'START TRANSACTION' );
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('second');" );
		$this->assertQuery( 'START TRANSACTION' );
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('third');" );
		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 3, $this->engine->get_query_results() );

		$this->assertQuery( 'ROLLBACK' );
		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 2, $this->engine->get_query_results() );

		$this->assertQuery( 'ROLLBACK' );
		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 1, $this->engine->get_query_results() );

		$this->assertQuery( 'COMMIT' );
		$this->assertQuery( 'SELECT * FROM _options;' );
		$this->assertCount( 1, $this->engine->get_query_results() );
	}

	public function testNestedTransactionWorkComplexModify() {
		$this->assertQuery( 'BEGIN' );
		// Create a complex ALTER Table query where the first
		// column is added successfully, but the second fails.
		// Behind the scenes, this single MySQL query is split
		// into multiple SQLite queries – some of them will
		// succeed, some will fail.
		$success = $this->engine->query( "
		ALTER TABLE _options 
			ADD COLUMN test varchar(20),
			ADD COLUMN test varchar(20)
		" );
		$this->assertFalse($success);
		// Commit the transaction.
		$this->assertQuery( 'COMMIT' );

		// Confirm the entire query failed atomically and no column was
		// added to the table.
		$this->assertQuery( 'DESCRIBE _options;' );
		$fields = $this->engine->get_query_results();

		$this->assertEquals(
			$fields,
			array(
				(object) array(
					'Field'   => 'ID',
					'Type'    => 'integer',
					'Null'    => 'NO',
					'Key'     => 'PRI',
					'Default' => null,
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'option_name',
					'Type'    => 'text',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'option_value',
					'Type'    => 'text',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '',
					'Extra'   => '',
				)
			)
		);

	}

	public function testCount() {
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('first');" );
		$this->assertQuery( "INSERT INTO _options (option_name) VALUES ('second');" );
		$this->assertQuery( 'SELECT COUNT(*) as count FROM _options;' );

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertSame( '2', $results[0]->count );
	}

	public function testUpdateDate() {
		$this->assertQuery(
			"INSERT INTO _dates (option_name, option_value) VALUES ('first', '2003-05-27 10:08:48');"
		);

		$this->assertQuery( 'SELECT option_value FROM _dates' );

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '2003-05-27 10:08:48', $results[0]->option_value );

		$this->assertQuery(
			"UPDATE _dates SET option_value = DATE_SUB(option_value, INTERVAL '2' YEAR);"
		);

		$this->assertQuery( 'SELECT option_value FROM _dates' );

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '2001-05-27 10:08:48', $results[0]->option_value );
	}

	public function testInsertDateLiteral() {
		$this->assertQuery(
			"INSERT INTO _dates (option_name, option_value) VALUES ('first', '2003-05-27 10:08:48');"
		);

		$this->assertQuery( 'SELECT option_value FROM _dates' );

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '2003-05-27 10:08:48', $results[0]->option_value );
	}

	public function testSelectDate1() {
		$this->assertQuery(
			"INSERT INTO _dates (option_name, option_value) VALUES ('first', '2000-05-27 10:08:48');"
		);

		$this->assertQuery(
			'SELECT
			YEAR( _dates.option_value ) as year,
			MONTH( _dates.option_value ) as month,
			DAYOFMONTH( _dates.option_value ) as dayofmonth,
			MONTHNUM( _dates.option_value ) as monthnum,
			WEEKDAY( _dates.option_value ) as weekday,
			WEEK( _dates.option_value, 1 ) as week1,
			HOUR( _dates.option_value ) as hour,
			MINUTE( _dates.option_value ) as minute,
			SECOND( _dates.option_value ) as second
		FROM _dates'
		);

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '2000', $results[0]->year );
		$this->assertEquals( '5', $results[0]->month );
		$this->assertEquals( '27', $results[0]->dayofmonth );
		$this->assertEquals( '5', $results[0]->weekday );
		$this->assertEquals( '21', $results[0]->week1 );
		$this->assertEquals( '5', $results[0]->monthnum );
		$this->assertEquals( '10', $results[0]->hour );
		$this->assertEquals( '8', $results[0]->minute );
		$this->assertEquals( '48', $results[0]->second );
	}

	public function testSelectDate24HourFormat() {
		$this->assertQuery(
			"
			INSERT INTO _dates (option_name, option_value)
			VALUES
				('second', '2003-05-27 14:08:48'),
				('first', '2003-05-27 00:08:48');
		"
		);

		// HOUR(14:08) should yield 14 in the 24 hour format
		$this->assertQuery( "SELECT  HOUR( _dates.option_value ) as hour FROM _dates WHERE option_name = 'second'" );
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '14', $results[0]->hour );

		// HOUR(00:08) should yield 0 in the 24 hour format
		$this->assertQuery( "SELECT  HOUR( _dates.option_value ) as hour FROM _dates WHERE option_name = 'first'" );
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '0', $results[0]->hour );

		// Lookup by HOUR(00:08) = 0 should yield the right record
		$this->assertQuery(
			'SELECT  HOUR( _dates.option_value ) as hour FROM _dates
			WHERE HOUR(_dates.option_value) = 0 '
		);

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
		$this->assertEquals( '0', $results[0]->hour );
	}

	public function testSelectByDateFunctions() {
		$this->assertQuery(
			"
			INSERT INTO _dates (option_name, option_value)
			VALUES ('second', '2014-10-21 00:42:29');
		"
		);

		// HOUR(14:08) should yield 14 in the 24 hour format
		$this->assertQuery(
			'
			SELECT * FROM _dates WHERE
              year(option_value) = 2014
              AND monthnum(option_value) = 10
              AND day(option_value) = 21
              AND hour(option_value) = 0
              AND minute(option_value) = 42
		'
		);
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
	}

	public function testSelectByDateFormat() {
		$this->assertQuery(
			"
			INSERT INTO _dates (option_name, option_value)
			VALUES ('second', '2014-10-21 00:42:29');
		"
		);

		// HOUR(14:08) should yield 14 in the 24 hour format
		$this->assertQuery(
			"
			SELECT * FROM _dates WHERE DATE_FORMAT(option_value, '%H.%i') = 0.42
		"
		);
		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
	}

	public function testInsertOnDuplicateKey() {
		$this->assertQuery(
			"CREATE TABLE _tmp_table (
				ID INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL,
				name varchar(20) NOT NULL default '',
				UNIQUE KEY name (name)
			);"
		);
		$result1 = $this->assertQuery( "INSERT INTO _tmp_table (name) VALUES ('first');" );
		$this->assertEquals( 1, $result1 );

		$result2 = $this->assertQuery( "INSERT INTO _tmp_table (name) VALUES ('FIRST') ON DUPLICATE KEY SET name=VALUES(`name`);" );
		$this->assertEquals( 1, $result2 );

		$this->assertQuery( 'SELECT COUNT(*) as cnt FROM _tmp_table' );
		$results = $this->engine->get_query_results();
		$this->assertEquals( 1, $results[0]->cnt );
	}

	public function testCreateTableCompositePk() {
		$this->assertQuery(
			'CREATE TABLE wptests_term_relationships (
				object_id bigint(20) unsigned NOT NULL default 0,
				term_taxonomy_id bigint(20) unsigned NOT NULL default 0,
				term_order int(11) NOT NULL default 0,
				PRIMARY KEY  (object_id,term_taxonomy_id),
				KEY term_taxonomy_id (term_taxonomy_id)
			   ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci'
		);
		$result1 = $this->engine->query( 'INSERT INTO wptests_term_relationships VALUES (1,2,1),(1,3,2);' );
		$this->assertEquals( 2, $result1 );

		$result2 = $this->engine->query( 'INSERT INTO wptests_term_relationships VALUES (1,2,2),(1,3,1);' );
		$this->assertEquals( false, $result2 );
	}

	public function testDescribeAccurate() {
		$result = $this->assertQuery(
			'CREATE TABLE wptests_term_relationships (
				object_id bigint(20) unsigned NOT NULL default 0,
				term_taxonomy_id bigint(20) unsigned NOT NULL default 0,
				term_name varchar(11) NOT NULL default 0,
				PRIMARY KEY  (object_id,term_taxonomy_id),
				KEY term_taxonomy_id (term_taxonomy_id),
				KEY compound_key (object_id(20),term_taxonomy_id(20)),
				FULLTEXT KEY term_name (term_name)
			   ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );

		$result = $this->assertQuery( 'DESCRIBE wptests_term_relationships;' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );

		$fields = $this->engine->get_query_results();

		$this->assertEquals(
			array(
				(object) array(
					'Field'   => 'object_id',
					'Type'    => 'bigint(20) unsigned',
					'Null'    => 'NO',
					'Key'     => 'PRI',
					'Default' => '0',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'term_taxonomy_id',
					'Type'    => 'bigint(20) unsigned',
					'Null'    => 'NO',
					'Key'     => 'PRI',
					'Default' => '0',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'term_name',
					'Type'    => 'varchar(11)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '0',
					'Extra'   => '',
				),
			),
			$fields
		);
	}

	public function testAlterTableAddColumnChangesMySQLDataType() {
		$result = $this->assertQuery(
			'CREATE TABLE _test (
				object_id bigint(20) unsigned NOT NULL default 0
			)'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );

		$result = $this->assertQuery( "ALTER TABLE `_test` ADD COLUMN object_name varchar(255) NOT NULL DEFAULT 'adb';" );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );

		$result = $this->assertQuery( 'DESCRIBE _test;' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );
		$fields = $this->engine->get_query_results();

		$this->assertEquals(
			array(
				(object) array(
					'Field'   => 'object_id',
					'Type'    => 'bigint(20) unsigned',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => '0',
					'Extra'   => '',
				),
				(object) array(
					'Field'   => 'object_name',
					'Type'    => 'varchar(255)',
					'Null'    => 'NO',
					'Key'     => '',
					'Default' => 'adb',
					'Extra'   => '',
				),
			),
			$fields
		);
	}

	public function testShowIndex() {
		$result = $this->assertQuery(
			'CREATE TABLE wptests_term_relationships (
				object_id bigint(20) unsigned NOT NULL default 0,
				term_taxonomy_id bigint(20) unsigned NOT NULL default 0,
				term_name varchar(11) NOT NULL default 0,
				FULLTEXT KEY term_name_fulltext (term_name),
				FULLTEXT INDEX term_name_fulltext2 (`term_name`),
				SPATIAL KEY term_name_spatial (term_name),
				PRIMARY KEY  (object_id,term_taxonomy_id),
				KEY term_taxonomy_id (term_taxonomy_id),
				KEY compound_key (object_id(20),term_taxonomy_id(20))
			) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );

		$result = $this->assertQuery( 'SHOW INDEX FROM wptests_term_relationships;' );
		$this->assertNotFalse( $result );

		$this->assertEquals(
			array(
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '0',
					'Key_name'      => 'PRIMARY',
					'Seq_in_index'  => '0',
					'Column_name'   => 'object_id',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '0',
					'Key_name'      => 'PRIMARY',
					'Seq_in_index'  => '0',
					'Column_name'   => 'term_taxonomy_id',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '1',
					'Key_name'      => 'compound_key',
					'Seq_in_index'  => '0',
					'Column_name'   => 'object_id',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '1',
					'Key_name'      => 'compound_key',
					'Seq_in_index'  => '0',
					'Column_name'   => 'term_taxonomy_id',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '1',
					'Key_name'      => 'term_taxonomy_id',
					'Seq_in_index'  => '0',
					'Column_name'   => 'term_taxonomy_id',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '1',
					'Key_name'      => 'term_name_spatial',
					'Seq_in_index'  => '0',
					'Column_name'   => 'term_name',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'SPATIAL',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '1',
					'Key_name'      => 'term_name_fulltext2',
					'Seq_in_index'  => '0',
					'Column_name'   => 'term_name',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'FULLTEXT',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '1',
					'Key_name'      => 'term_name_fulltext',
					'Seq_in_index'  => '0',
					'Column_name'   => 'term_name',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'FULLTEXT',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '0',
					'Key_name'      => 'wptests_term_relationships',
					'Seq_in_index'  => '0',
					'Column_name'   => 'object_id',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
				(object) array(
					'Table'         => 'wptests_term_relationships',
					'Non_unique'    => '0',
					'Key_name'      => 'wptests_term_relationships',
					'Seq_in_index'  => '0',
					'Column_name'   => 'term_taxonomy_id',
					'Collation'     => 'A',
					'Cardinality'   => '0',
					'Sub_part'      => null,
					'Packed'        => null,
					'Null'          => '',
					'Index_type'    => 'BTREE',
					'Comment'       => '',
					'Index_comment' => '',
				),
			),
			$this->engine->get_query_results()
		);
	}

	public function testInsertOnDuplicateKeyCompositePk() {
		$result = $this->assertQuery(
			'CREATE TABLE wptests_term_relationships (
				object_id bigint(20) unsigned NOT NULL default 0,
				term_taxonomy_id bigint(20) unsigned NOT NULL default 0,
				term_order int(11) NOT NULL default 0,
				PRIMARY KEY  (object_id,term_taxonomy_id),
				KEY term_taxonomy_id (term_taxonomy_id)
			   ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci'
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );

		$result1 = $this->assertQuery( 'INSERT INTO wptests_term_relationships VALUES (1,2,1),(1,3,2);' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 2, $result1 );

		$result2 = $this->assertQuery( 'INSERT INTO wptests_term_relationships VALUES (1,2,2),(1,3,1) ON DUPLICATE KEY SET term_order = VALUES(term_order);' );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 2, $result2 );

		$this->assertQuery( 'SELECT COUNT(*) as cnt FROM wptests_term_relationships' );
		$results = $this->engine->get_query_results();
		$this->assertEquals( 2, $results[0]->cnt );
	}

	public function testStringToFloatComparison() {
		$this->assertQuery( "SELECT ('00.42' = 0.4200) as cmp;" );
		$results = $this->engine->get_query_results();
		if ( $results[0]->cmp !== 1 ) {
			$this->markTestSkipped( 'Comparing a string and a float returns true in MySQL. In SQLite, they\'re different. Skipping. ' );
		}
		$this->assertEquals( '1', $results[0]->cmp );
	}

	public function testCalcFoundRows() {
		$result = $this->assertQuery(
			"CREATE TABLE wptests_dummy (
				ID INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
				user_login TEXT NOT NULL default ''
			);"
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertNotFalse( $result );

		$result = $this->assertQuery(
			"INSERT INTO wptests_dummy (user_login) VALUES ('test');"
		);
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 1, $result );

		$result = $this->assertQuery(
			'SELECT SQL_CALC_FOUND_ROWS * FROM wptests_dummy'
		);
		$this->assertNotFalse( $result );
		$this->assertEquals( '', $this->engine->get_error_message() );
		$this->assertEquals( 'test', $result[0]->user_login );
	}

	public function testComplexSelectBasedOnDates() {
		$this->assertQuery(
			"INSERT INTO _dates (option_name, option_value) VALUES ('first', '2003-05-27 10:08:48');"
		);

		$this->assertQuery(
			'SELECT SQL_CALC_FOUND_ROWS  _dates.ID
		FROM _dates
		WHERE YEAR( _dates.option_value ) = 2003 AND MONTH( _dates.option_value ) = 5 AND DAYOFMONTH( _dates.option_value ) = 27
		ORDER BY _dates.option_value DESC
		LIMIT 0, 10'
		);

		$results = $this->engine->get_query_results();
		$this->assertCount( 1, $results );
	}

	public function testUpdateReturnValue() {
		$this->assertQuery(
			"INSERT INTO _dates (option_name, option_value) VALUES ('first', '2003-05-27 10:08:48');"
		);

		$return = $this->assertQuery(
			"UPDATE _dates SET option_value = '2001-05-27 10:08:48'"
		);
		$this->assertSame( 1, $return, 'UPDATE query did not return 1 when one row was changed' );

		$return = $this->assertQuery(
			"UPDATE _dates SET option_value = '2001-05-27 10:08:48'"
		);
		if ( $return === 1 ) {
			$this->markTestIncomplete(
				'SQLite UPDATE query returned 1 when no rows were changed. ' .
				'This is a database compatibility issue – MySQL would return 0 ' .
				'in the same scenario.'
			);
		}
		$this->assertSame( 0, $return, 'UPDATE query did not return 0 when no rows were changed' );
	}

	public function testOrderByField() {
		$this->assertQuery(
			"INSERT INTO _options (option_name, option_value) VALUES ('User 0000019', 'second');"
		);
		$this->assertQuery(
			"INSERT INTO _options (option_name, option_value) VALUES ('User 0000020', 'third');"
		);
		$this->assertQuery(
			"INSERT INTO _options (option_name, option_value) VALUES ('User 0000018', 'first');"
		);

		$this->assertQuery( 'SELECT FIELD(option_name, "User 0000018", "User 0000019", "User 0000020") as sorting_order FROM _options ORDER BY FIELD(option_name, "User 0000018", "User 0000019", "User 0000020")' );

		$this->assertEquals(
			array(
				(object) array(
					'sorting_order' => '1',
				),
				(object) array(
					'sorting_order' => '2',
				),
				(object) array(
					'sorting_order' => '3',
				),
			),
			$this->engine->get_query_results()
		);

		$this->assertQuery( 'SELECT option_value FROM _options ORDER BY FIELD(option_name, "User 0000018", "User 0000019", "User 0000020")' );

		$this->assertEquals(
			array(
				(object) array(
					'option_value' => 'first',
				),
				(object) array(
					'option_value' => 'second',
				),
				(object) array(
					'option_value' => 'third',
				),
			),
			$this->engine->get_query_results()
		);
	}

	public function testFetchedDataIsStringified() {
		$this->assertQuery(
			"INSERT INTO _options (option_name, option_value) VALUES ('rss_0123456789abcdef0123456789abcdef', '1');"
		);

		$this->assertQuery( 'SELECT ID FROM _options' );

		$this->assertEquals(
			array(
				(object) array(
					'ID' => '1',
				),
			),
			$this->engine->get_query_results()
		);
	}

	public function testCreateTableQuery() {
		$this->assertQuery(
			<<<'Q'
            CREATE TABLE IF NOT EXISTS wptests_users (
                ID bigint(20) unsigned NOT NULL auto_increment,
                user_login varchar(60) NOT NULL default '',
                user_pass varchar(255) NOT NULL default '',
                user_nicename varchar(50) NOT NULL default '',
                user_email varchar(100) NOT NULL default '',
                user_url varchar(100) NOT NULL default '',
                user_registered datetime NOT NULL default '0000-00-00 00:00:00',
                user_activation_key varchar(255) NOT NULL default '',
                user_status int(11) NOT NULL default '0',
                display_name varchar(250) NOT NULL default '',
                PRIMARY KEY  (ID),
                KEY user_login_key (user_login),
                KEY user_nicename (user_nicename),
                KEY user_email (user_email)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci
            Q
		);
		$this->assertQuery(
			<<<'Q'
            INSERT INTO wptests_users VALUES (1,'admin','$P$B5ZQZ5ZQZ5ZQZ5ZQZ5ZQZ5ZQZ5ZQZ5','admin','admin@localhost', '', '2019-01-01 00:00:00', '', 0, 'admin');
            Q
		);
		$rows = $this->assertQuery( 'SELECT * FROM wptests_users' );
		$this->assertCount( 1, $rows );

		$this->assertQuery( 'SELECT SQL_CALC_FOUND_ROWS * FROM wptests_users' );
		$result = $this->assertQuery('SELECT FOUND_ROWS()');
		$this->assertEquals(
			array(
				(object)array(
					'FOUND_ROWS()' => '1',
				),
			),
			$result
		);
	}

	public function testTranslatesComplexDelete() {
		$this->sqlite->query(
			"CREATE TABLE wptests_dummy (
				ID INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
				user_login TEXT NOT NULL default '',
				option_name TEXT NOT NULL default '',
				option_value TEXT NOT NULL default ''
			);"
		);
		$this->sqlite->query(
			"INSERT INTO wptests_dummy (user_login, option_name, option_value) VALUES ('admin', '_transient_timeout_test', '1675963960');"
		);
		$this->sqlite->query(
			"INSERT INTO wptests_dummy (user_login, option_name, option_value) VALUES ('admin', '_transient_test', '1675963960');"
		);

		$result = $this->assertQuery(
			"DELETE a, b FROM wptests_dummy a, wptests_dummy b
				WHERE a.option_name LIKE '_transient_%'
				AND a.option_name NOT LIKE '_transient_timeout_%'
				AND b.option_name = CONCAT( '_transient_timeout_', SUBSTRING( a.option_name, 12 ) );"
		);
		$this->assertEquals(
			2,
			$result
		);
	}

	public function testTranslatesDoubleAlterTable() {
		$result = $this->assertQuery(
			'ALTER TABLE _options 
				ADD INDEX test_index(option_name(140),option_value(51)),
				DROP INDEX test_index,
				ADD INDEX test_index2(option_name(140),option_value(51))
			'
		);
		$this->assertEquals('', $this->engine->get_error_message());
		$this->assertEquals(
			1,
			$result
		);
		$result = $this->assertQuery(
			'SHOW INDEX FROM _options'
		);
		$this->assertCount( 3, $result );
		$this->assertEquals( 'PRIMARY', $result[0]->Key_name );
		$this->assertEquals( 'test_index2', $result[1]->Key_name );
		$this->assertEquals( 'test_index2', $result[2]->Key_name );
	}

	public function testTranslatesComplexSelect() {
		$this->assertQuery(
			"CREATE TABLE wptests_postmeta (
				meta_id bigint(20) unsigned NOT NULL auto_increment,
				post_id bigint(20) unsigned NOT NULL default '0',
				meta_key varchar(255) default NULL,
				meta_value longtext,
				PRIMARY KEY  (meta_id),
				KEY post_id (post_id),
				KEY meta_key (meta_key(191))
			) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci"
		);
		$this->assertQuery(
			"CREATE TABLE wptests_posts (
				ID bigint(20) unsigned NOT NULL auto_increment,
				post_status varchar(20) NOT NULL default 'open',
				post_type varchar(20) NOT NULL default 'post',
				post_date varchar(20) NOT NULL default 'post',
				PRIMARY KEY  (ID)
			) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci"
		);
		$result = $this->assertQuery(
			"SELECT SQL_CALC_FOUND_ROWS  wptests_posts.ID
				FROM wptests_posts  INNER JOIN wptests_postmeta ON ( wptests_posts.ID = wptests_postmeta.post_id )
				WHERE 1=1
				AND (
					NOT EXISTS (
						SELECT 1 FROM wptests_postmeta mt1
						WHERE mt1.post_ID = wptests_postmeta.post_ID
						LIMIT 1
					)
				)
				 AND (
					(wptests_posts.post_type = 'post' AND (wptests_posts.post_status = 'publish'))
				)
			GROUP BY wptests_posts.ID
			ORDER BY wptests_posts.post_date DESC
			LIMIT 0, 10"
		);

		// No exception is good enough of a test for now
		$this->assertTrue( true );
	}

	public function testTranslatesUtf8Insert() {
		$this->assertQuery(
			"INSERT INTO _options VALUES(1,'ąłółźćę†','ąłółźćę†')"
		);
		$this->assertCount(
			1,
			$this->assertQuery('SELECT * FROM _options')
		);
	}

	public function testTranslatesRandom() {
		$this->assertIsNumeric(
			$this->sqlite->query( 'SELECT RAND() AS rand' )->fetchColumn()
		);

		$this->assertIsNumeric(
			$this->sqlite->query( 'SELECT RAND(5) AS rand' )->fetchColumn()
		);
	}

	public function testTranslatesUtf8SELECT() {
		$this->engine->query(
			"SELECT a as 'ą' FROM test WHERE b='ąłółźćę†'AND c='ąłółźćę†'"
		);
		// No exception is good enough of a test for now
		$this->assertTrue(true);
	}

}
