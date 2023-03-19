<?php

class WP_SQLite_Crosscheck_DB_ extends WP_SQLite_DB {

	public function __construct() {
		parent::__construct();
		$GLOBALS['sqlite'] = $this;
		$GLOBALS['mysql']  = new wpdb(
			DB_USER,
			DB_PASSWORD,
			DB_NAME,
			DB_HOST
		);
		// $this->resetDatabases();
	}

	private function resetDatabases() {
		if ( file_exists( FQDB ) ) {
			unlink( FQDB );
		}
		$GLOBALS['mysql']->query( 'DROP DATABASE IF EXISTS ' . DB_NAME );
		$GLOBALS['mysql']->query( 'CREATE DATABASE ' . DB_NAME );
		$GLOBALS['mysql']->query( 'USE ' . DB_NAME );
	}

	public function query( $query ) {
		/**
		 * In MySQL, AUTO_INCREMENT columns don't reuse IDs assigned in rollback transactions
		 * In SQLite, AUTOINCREMENT columns do reuse IDs assigned in rollback transactions
		 *
		 * Let's store the current AUTOINCREMENT value for each table, and restore it afterwards.
		 */
		if ( preg_match( '/^\s*rollback/i', $query ) ) {
			$autoincrements = array();
			$tables         = $GLOBALS['@pdo']->query( "SELECT name as `table` FROM sqlite_master WHERE type='table' ORDER BY name" )->fetchAll();
			foreach ( $tables as $table ) {
				$table                    = $table['table'];
				$autoincrement            = $GLOBALS['@pdo']->query( "SELECT seq FROM sqlite_sequence WHERE name = '$table'" )->fetchColumn();
				$autoincrements[ $table ] = $autoincrement ?: 1;
			}
		}
		$sqlite_retval = parent::query( $query );
		if ( preg_match( '/^\s*rollback/i', $query ) ) {
			foreach ( $autoincrements as $table => $autoincrement ) {
				$GLOBALS['@pdo']->query( "UPDATE sqlite_sequence SET seq = $autoincrement WHERE name = '$table'" );
			}
		}
		$this->crosscheck( $query, $sqlite_retval );
		return $sqlite_retval;
	}

	private function crosscheck( $query, $sqlite_retval ) {
		// echo $query."\n\n";
		// Be lenient on cross-checking some query types
		if ( preg_match( '/^\s*SET storage_engine/i', $query ) ) {
			return;
		}
		$this->show_errors                 = false;
		$this->suppress_errors             = true;
		$GLOBALS['mysql']->show_errors     = false;
		$GLOBALS['mysql']->suppress_errors = true;

		ob_start();
		$mysql_retval = $GLOBALS['mysql']->query( $query );
		ob_end_clean();

		$tests = array(
			array( 'retval', $mysql_retval, $sqlite_retval ),
			array( 'num_rows', $GLOBALS['mysql']->num_rows, $GLOBALS['sqlite']->num_rows ),
			array( 'insert_id', $GLOBALS['mysql']->insert_id, $GLOBALS['sqlite']->insert_id ),
			array( 'rows_affected', $GLOBALS['mysql']->rows_affected, $GLOBALS['sqlite']->rows_affected ),
		);

		foreach ( $tests as $test ) {
			list($factor, $mysql, $sqlite) = $test;
			if ( $mysql !== $sqlite ) {
				if ( $factor === 'insert_id' ) {
					// On multi-inserts MySQL returns the first inserted ID
					// while SQLite returns the last one. The cached insert_id
					// value stays the same for a number of subsequent queries.
					// Let's forgive this for now.
					continue;
				}
				if ( $factor === 'rows_affected' && $mysql_retval === $mysql ) {
					// SQLite doesn't provide the rowcount() functionallity
					continue;
				}
				if ( $factor === 'retval' && $GLOBALS['mysql']->rows_affected === $mysql ) {
					// SQLite doesn't provide the rowcount() functionallity
					continue;
				}
				echo "======================================================\n";
				echo "======== *** $factor ***  differed for query ========= \n";
				echo "======================================================\n";
				echo "MySQL query: \n";
				echo "$query\n\n";

				echo "SQLite queries: \n";
				foreach ( $this->dbh->last_translation->queries as $query ) {
					echo $query->sql . "\n";
				}
				echo "\n";

				$this->report_factor(
					'error',
					$GLOBALS['mysql']->last_error,
					$GLOBALS['sqlite']->last_error
				);
				foreach ( $tests as $test ) {
					$this->report_factor(
						$test[0],
						$test[1],
						$test[2]
					);
				}
				// throw new Exception();
				break;
			}
		}

	}

	private function report_factor( $factor, $mysql, $sqlite ) {
		echo "$factor: \n";
		echo '  MySQL: ' . var_export( $mysql, true ) . "\n";
		echo '  SQLite: ' . var_export( $sqlite, true ) . "\n\n";
	}

}
