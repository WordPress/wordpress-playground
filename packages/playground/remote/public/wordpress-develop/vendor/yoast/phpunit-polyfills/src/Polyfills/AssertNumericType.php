<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

/**
 * Polyfill the Assert::assertFinite(), Assert::assertInfinite() and Assert::assertNan() methods.
 *
 * Introduced in PHPUnit 5.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/pull/1753
 */
trait AssertNumericType {

	/**
	 * Asserts that a variable is finite.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFinite( $actual, $message = '' ) {
		static::assertTrue( \is_finite( $actual ), $message );
	}

	/**
	 * Asserts that a variable is infinite.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertInfinite( $actual, $message = '' ) {
		static::assertTrue( \is_infinite( $actual ), $message );
	}

	/**
	 * Asserts that a variable is non a number.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertNan( $actual, $message = '' ) {
		static::assertTrue( \is_nan( $actual ), $message );
	}
}
