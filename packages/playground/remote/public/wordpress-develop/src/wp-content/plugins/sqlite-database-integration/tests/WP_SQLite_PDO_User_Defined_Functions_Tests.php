<?php

use PHPUnit\Framework\TestCase;

class WP_SQLite_PDO_User_Defined_Functions_Tests extends TestCase {

	/**
	 * @covers WP_SQLite_PDO_User_Defined_Functions::field
	 * @dataProvider dataProviderForTestFieldFunction
	 */
	public function testFieldFunction( $expected, $args ) {
		$pdo = new PDO( 'sqlite::memory:' );
		$fns = new WP_SQLite_PDO_User_Defined_Functions( $pdo );

		$this->assertEquals(
			$expected,
			$fns->field( ...$args )
		);
	}

	function dataProviderForTestFieldFunction() {
		return array(
			array( 1, array( 'a', 'a' ) ),
			array( 2, array( 'User 0000019', 'User 0000018', 'User 0000019', 'User 0000020' ) ),
		);
	}

}
