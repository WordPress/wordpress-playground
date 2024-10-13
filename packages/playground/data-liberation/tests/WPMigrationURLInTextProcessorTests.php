<?php

use PHPUnit\Framework\TestCase;

class WPMigrationURLInTextProcessorTests extends TestCase {

	/**
	 *
	 * @dataProvider provider_test_finds_next_url_when_base_url_is_used
	 */
	public function test_finds_next_url_when_base_url_is_used( $url, $parsed_href, $text, $which_url = 1 ) {
		$p = new WP_Migration_URL_In_Text_Processor( $text, 'https://w.org' );
		for ( $i = 0; $i < $which_url; $i ++ ) {
			$this->assertTrue( $p->next_url(), 'Failed to find the URL in the text.' );
		}
		$this->assertEquals( $url, $p->get_raw_url(), 'Found a URL in the text, but it wasn\'t the expected one.' );
		$this->assertEquals( $parsed_href, $p->get_parsed_url()->href, 'Found a URL in the text, but it wasn\'t the expected one.' );
	}

	static public function provider_test_finds_next_url_when_base_url_is_used() {
		return [
			'Absolute URL (first)'                           => [
				'https://wordpress.org',
				'https://wordpress.org/',
				'Have you seen https://wordpress.org?',
			],
			'Absolute URL (second) '                         => [
				'https://w.org',
				'https://w.org/',
				'Have you seen https://wordpress.org or https://w.org?',
				2,
			],
			'Absolute URL with an all-ASCII path'            => [
				'https://w.org/plugins',
				'https://w.org/plugins',
				'Visit the WordPress plugins directory https://w.org/plugins',
			],
			'Absolute URL with a UTF-8 query'                => [
				'https://w.org/plugins?łąka=1',
				'https://w.org/plugins?%C5%82%C4%85ka=1',
				'Visit the WordPress plugins directory https://w.org/plugins?łąka=1',
			],
			'Absolute URL with a urlencoded all-ASCII query' => [
				'https://w.org/plugins?%C5%82%C4%85ka=1',
				'https://w.org/plugins?%C5%82%C4%85ka=1',
				'Visit the WordPress plugins directory https://w.org/plugins?%C5%82%C4%85ka=1',
			],
			'Protocol-relative URL'                          => [ '//w.org/', 'https://w.org/', 'Visit the WordPress org at //w.org/ ' ],
			'UTF-8 characters in the path'                   => [
				'https://w.org/łąka',
				'https://w.org/%C5%82%C4%85ka',
				'Visit the WordPress plugins directory https://w.org/łąka',
			],
			'Domain-only'                                    => [ 'www.example.com', 'https://www.example.com/', 'Visit www.example.com' ],
			'Domain + path'                                  => [
				'www.example.com/path',
				'https://www.example.com/path',
				'Visit www.example.com/path',
			],
			'UTF-8 domain'                                   => [ 'łąka.pl', 'https://xn--ka-ola7v.pl/', 'Więcej na łąka.pl' ],
			'Skips the closing parenthesis after the path'   => [
				'https://w.org/plugins',
				'https://w.org/plugins',
				'Visit the WordPress plugins directory (https://w.org/plugins)',
			],
			'Retains the parenthesis within the path'        => [
				'https://w.org/plug(in)s',
				'https://w.org/plug(in)s',
				'Visit the WordPress plugins directory (https://w.org/plug(in)s',
			],
			'Skips index.html'                               => [
				'www.example.com',
				'https://www.example.com/',
				'Visit index.html www.example.com',
			],
		];
	}

	public function test_set_url_returns_true_on_success() {
		$p = new WP_Migration_URL_In_Text_Processor( 'Have you seen https://wordpress.org?' );
		$p->next_url();
		$this->assertTrue( $p->set_raw_url( 'https://w.org' ), 'Failed to set the URL in the text.' );
	}

	public function test_set_url_returns_false_on_failure() {
		$p = new WP_Migration_URL_In_Text_Processor( 'Have you seen WordPress?' );
		$p->next_url();
		$this->assertFalse( $p->set_raw_url( 'https://w.org' ), 'set_url returned true when no URL was matched.' );
	}

	/**
	 *
	 * @dataProvider provider_test_set_url_data
	 */
	public function test_set_url_replaces_the_url( $text, $new_url, $expected_text ) {
		$p = new WP_Migration_URL_In_Text_Processor( $text );
		$p->next_url();
		$p->set_raw_url( $new_url );
		$this->assertEquals(
			$new_url,
			$p->get_raw_url(),
			'Failed to set the URL in the text.'
		);
		$this->assertEquals(
			$expected_text,
			$p->get_updated_text(),
			'Failed to set the URL in the text.'
		);
	}

	static public function provider_test_set_url_data() {
		return [
			'Replace with HTTPS URL'               => [
				'Have you seen https://wordpress.org (or wp.org)?',
				'https://wikipedia.org',
				'Have you seen https://wikipedia.org (or wp.org)?',
			],
			'Replace with a protocol-relative URL' => [
				'Have you seen https://wordpress.org (or wp.org)?',
				'//wikipedia.org',
				'Have you seen //wikipedia.org (or wp.org)?',
			],
			'Replace with a schema-less URL'       => [
				'Have you seen https://wordpress.org (or wp.org)?',
				'wikipedia.org',
				'Have you seen wikipedia.org (or wp.org)?',
			],
		];
	}

	public function test_set_url_can_be_called_twice() {
		$p = new WP_Migration_URL_In_Text_Processor( 'Have you seen https://wordpress.org (or w.org)?' );
		$p->next_url();
		$p->set_raw_url( 'https://developer.wordpress.org' );
		$p->get_updated_text();
		$p->set_raw_url( 'https://wikipedia.org' );
		$this->assertEquals(
			'https://wikipedia.org',
			$p->get_raw_url(),
			'Failed to set the URL in the text.'
		);
		$this->assertEquals(
			'Have you seen https://wikipedia.org (or w.org)?',
			$p->get_updated_text(),
			'Failed to set the URL in the text.'
		);
	}

	public function test_set_url_can_be_called_twice_before_moving_on() {
		$p = new WP_Migration_URL_In_Text_Processor( 'Have you seen https://wordpress.org (or w.org)?', 'https://w.org' );
		$p->next_url();
		$p->set_raw_url( 'https://wikipedia.org' );
		$p->get_updated_text();
		$p->set_raw_url( 'https://developer.wordpress.org' );
		$p->next_url();
		$p->set_raw_url( 'https://meetups.wordpress.org' );
		$this->assertEquals(
			'Have you seen https://developer.wordpress.org (or meetups.wordpress.org)?',
			$p->get_updated_text(),
			'Failed to set the URL in the text.'
		);
	}
}
