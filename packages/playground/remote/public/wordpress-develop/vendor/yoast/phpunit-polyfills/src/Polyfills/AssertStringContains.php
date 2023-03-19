<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

/**
 * Polyfill the Assert::assertStringContainsString() et al methods, which replace the use of
 * Assert::assertContains() and Assert::assertNotContains() with string haystacks.
 *
 * Introduced in PHPUnit 7.5.0.
 * Use of Assert::assertContains() and Assert::assertNotContains() with string haystacks was
 * deprecated in PHPUnit 7.5.0 and removed in PHPUnit 9.0.0.
 *
 * Note: this polyfill accounts for a bug in PHPUnit < 6.4.2.
 * Prior to PHPUnit 6.4.2, when the $needle was an empty string, a PHP native
 * "mb_strpos(): Empty delimiter" warning would be thrown, which would result
 * in the test failing.
 * This polyfill prevents that warning and emulates the PHPUnit >= 6.4.2 behaviour.
 *
 * @link https://github.com/sebastianbergmann/phpunit/issues/3422
 * @link https://github.com/sebastianbergmann/phpunit/issues/2520
 * @link https://github.com/sebastianbergmann/phpunit/pull/2778
 */
trait AssertStringContains {

	/**
	 * Asserts that a string haystack contains a needle.
	 *
	 * @param string $needle   The string to search for.
	 * @param string $haystack The string to treat as the haystack.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringContainsString( $needle, $haystack, $message = '' ) {
		if ( $needle === '' ) {
			static::assertSame( $needle, $needle, $message );
			return;
		}

		static::assertContains( $needle, $haystack, $message );
	}

	/**
	 * Asserts that a string haystack contains a needle (case-insensitive).
	 *
	 * @param string $needle   The string to search for.
	 * @param string $haystack The string to treat as the haystack.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringContainsStringIgnoringCase( $needle, $haystack, $message = '' ) {
		if ( $needle === '' ) {
			static::assertSame( $needle, $needle, $message );
			return;
		}

		static::assertContains( $needle, $haystack, $message, true );
	}

	/**
	 * Asserts that a string haystack does NOT contain a needle.
	 *
	 * @param string $needle   The string to search for.
	 * @param string $haystack The string to treat as the haystack.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringNotContainsString( $needle, $haystack, $message = '' ) {
		if ( $needle === '' ) {
			if ( $message === '' ) {
				$message = "Failed asserting that '{$haystack}' does not contain \"{$needle}\".";
			}

			static::fail( $message );
		}

		static::assertNotContains( $needle, $haystack, $message );
	}

	/**
	 * Asserts that a string haystack does NOT contain a needle (case-insensitive).
	 *
	 * @param string $needle   The string to search for.
	 * @param string $haystack The string to treat as the haystack.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringNotContainsStringIgnoringCase( $needle, $haystack, $message = '' ) {
		if ( $needle === '' ) {
			if ( $message === '' ) {
				$message = "Failed asserting that '{$haystack}' does not contain \"{$needle}\".";
			}

			static::fail( $message );
		}

		static::assertNotContains( $needle, $haystack, $message, true );
	}
}
