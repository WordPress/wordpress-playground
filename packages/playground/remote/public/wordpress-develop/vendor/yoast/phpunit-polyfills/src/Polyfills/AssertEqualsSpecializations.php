<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

/**
 * Polyfill the Assert::assertEqualsCanonicalizing(), Assert::assertEqualsIgnoringCase(),
 * Assert::assertEqualsWithDelta() and their `Not` variant methods, which replace the
 * use of Assert::assertEquals() and Assert::assertNotEquals() with these optional parameters.
 *
 * Introduced in PHPUnit 7.5.0.
 * Use of Assert::assertEquals() and Assert::assertNotEquals() with these respective optional parameters was
 * deprecated in PHPUnit 7.5.0 and removed in PHPUnit 9.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/issues/3340
 */
trait AssertEqualsSpecializations {

	/**
	 * Asserts that two variables are equal (canonicalizing).
	 *
	 * @param mixed  $expected Expected value.
	 * @param mixed  $actual   The value to test.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertEqualsCanonicalizing( $expected, $actual, $message = '' ) {
		static::assertEquals( $expected, $actual, $message, 0.0, 10, true );
	}

	/**
	 * Asserts that two variables are equal (ignoring case).
	 *
	 * @param mixed  $expected Expected value.
	 * @param mixed  $actual   The value to test.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertEqualsIgnoringCase( $expected, $actual, $message = '' ) {
		static::assertEquals( $expected, $actual, $message, 0.0, 10, false, true );
	}

	/**
	 * Asserts that two variables are equal (with delta).
	 *
	 * @param mixed  $expected Expected value.
	 * @param mixed  $actual   The value to test.
	 * @param float  $delta    The delta to allow between the expected and the actual value.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertEqualsWithDelta( $expected, $actual, $delta, $message = '' ) {
		static::assertEquals( $expected, $actual, $message, $delta );
	}

	/**
	 * Asserts that two variables are not equal (canonicalizing).
	 *
	 * @param mixed  $expected Expected value.
	 * @param mixed  $actual   The value to test.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertNotEqualsCanonicalizing( $expected, $actual, $message = '' ) {
		static::assertNotEquals( $expected, $actual, $message, 0.0, 10, true );
	}

	/**
	 * Asserts that two variables are not equal (ignoring case).
	 *
	 * @param mixed  $expected Expected value.
	 * @param mixed  $actual   The value to test.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertNotEqualsIgnoringCase( $expected, $actual, $message = '' ) {
		static::assertNotEquals( $expected, $actual, $message, 0.0, 10, false, true );
	}

	/**
	 * Asserts that two variables are not equal (with delta).
	 *
	 * @param mixed  $expected Expected value.
	 * @param mixed  $actual   The value to test.
	 * @param float  $delta    The delta to allow between the expected and the actual value.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertNotEqualsWithDelta( $expected, $actual, $delta, $message = '' ) {
		static::assertNotEquals( $expected, $actual, $message, $delta );
	}
}
