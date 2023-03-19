<?php

use PHPUnit\Framework\TestCase;

class WP_SQLite_Query_RewriterTests extends TestCase {


	public function testConsume() {
		$r = new WP_SQLite_Query_Rewriter(
			array(
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_DELIMITER ),
				new WP_SQLite_Token( 'int', WP_SQLite_Token::TYPE_KEYWORD, WP_SQLite_Token::FLAG_KEYWORD_DATA_TYPE ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_DELIMITER ),
				new WP_SQLite_Token( 'DATE_ADD', WP_SQLite_Token::TYPE_KEYWORD, WP_SQLite_Token::FLAG_KEYWORD_FUNCTION ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_DELIMITER ),
				new WP_SQLite_Token( 'SET', WP_SQLite_Token::TYPE_KEYWORD ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_WHITESPACE ),
			)
		);
		$this->assertEquals(
			'int',
			$r->consume(
				array(
					'type'  => WP_SQLite_Token::TYPE_KEYWORD,
					'flags' => WP_SQLite_Token::FLAG_KEYWORD_DATA_TYPE,
				)
			)->value
		);
		$this->assertEquals(
			'DATE_ADD',
			$r->consume(
				array(
					'type'  => WP_SQLite_Token::TYPE_KEYWORD,
					'flags' => WP_SQLite_Token::FLAG_KEYWORD_FUNCTION,
				)
			)->value
		);
	}
	public function testSkip() {
		$r = new WP_SQLite_Query_Rewriter(
			array(
				new WP_SQLite_Token( 'DO', WP_SQLite_Token::TYPE_KEYWORD ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_WHITESPACE ),
				new WP_SQLite_Token( 'UPDATE', WP_SQLite_Token::TYPE_KEYWORD ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_WHITESPACE ),
				new WP_SQLite_Token( 'SET', WP_SQLite_Token::TYPE_KEYWORD ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_WHITESPACE ),
			)
		);
		$this->assertEquals(
			'DO',
			$r->skip()->value
		);
		$this->assertEquals(
			'UPDATE',
			$r->skip()->value
		);
	}

	public function skip_over() {
		$r      = new WP_SQLite_Query_Rewriter(
			array(
				new WP_SQLite_Token( 'DO', WP_SQLite_Token::TYPE_KEYWORD ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_WHITESPACE ),
				new WP_SQLite_Token( 'UPDATE', WP_SQLite_Token::TYPE_KEYWORD ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_WHITESPACE ),
				new WP_SQLite_Token( 'SET', WP_SQLite_Token::TYPE_KEYWORD ),
				new WP_SQLite_Token( ' ', WP_SQLite_Token::TYPE_WHITESPACE ),
			)
		);
		$buffer = $r->skip_over(
			array(
				'values' => array( 'UPDATE' ),
			)
		);
		$this->assertCount( 3, $buffer );
		$this->assertEquals( 'DO', $buffer[0]->value );
		$this->assertEquals( ' ', $buffer[1]->value );
		$this->assertEquals( 'UPDATE', $buffer[2]->value );
	}

}
