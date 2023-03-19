<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

/**
 * Polyfill the `Assert::assertFileEqualsCanonicalizing()`, `Assert::assertFileEqualsIgnoringCase()`,
 * `Assert::assertStringEqualsFileCanonicalizing()`, `Assert::assertStringEqualsFileIgnoringCase()`,
 * `Assert::assertFileNotEqualsCanonicalizing()`, `Assert::assertFileNotEqualsIgnoringCase()`,
 * `Assert::assertStringNotEqualsFileCanonicalizing()` and `Assert::assertStringNotEqualsFileIgnoringCase()`
 * as alternative to using `Assert::assertFileEquals()` etc. with optional parameters
 *
 * Introduced in PHPUnit 8.5.0.
 * Use of Assert::assertFileEquals() and Assert::assertFileNotEquals() with these optional parameters was
 * deprecated in PHPUnit 8.5.0 and removed in PHPUnit 9.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/issues/3949
 * @link https://github.com/sebastianbergmann/phpunit/issues/3951
 */
trait AssertFileEqualsSpecializations {

	/**
	 * Asserts that the contents of one file is equal to the contents of another
	 * file (canonicalizing).
	 *
	 * @param string $expected Path to file with expected content.
	 * @param string $actual   Path to file with actual content.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileEqualsCanonicalizing( $expected, $actual, $message = '' ) {
		static::assertFileEquals( $expected, $actual, $message, true );
	}

	/**
	 * Asserts that the contents of one file is equal to the contents of another
	 * file (ignoring case).
	 *
	 * @param string $expected Path to file with expected content.
	 * @param string $actual   Path to file with actual content.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileEqualsIgnoringCase( $expected, $actual, $message = '' ) {
		static::assertFileEquals( $expected, $actual, $message, false, true );
	}

	/**
	 * Asserts that the contents of one file is not equal to the contents of another
	 * file (canonicalizing).
	 *
	 * @param string $expected Path to file with expected content.
	 * @param string $actual   Path to file with actual content.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileNotEqualsCanonicalizing( $expected, $actual, $message = '' ) {
		static::assertFileNotEquals( $expected, $actual, $message, true );
	}

	/**
	 * Asserts that the contents of one file is not equal to the contents of another
	 * file (ignoring case).
	 *
	 * @param string $expected Path to file with expected content.
	 * @param string $actual   Path to file with actual content.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileNotEqualsIgnoringCase( $expected, $actual, $message = '' ) {
		static::assertFileNotEquals( $expected, $actual, $message, false, true );
	}

	/**
	 * Asserts that the contents of a string is equal to the contents of
	 * a file (canonicalizing).
	 *
	 * @param string $expectedFile Path to file with expected content.
	 * @param string $actualString Actual content.
	 * @param string $message      Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringEqualsFileCanonicalizing( $expectedFile, $actualString, $message = '' ) {
		static::assertStringEqualsFile( $expectedFile, $actualString, $message, true );
	}

	/**
	 * Asserts that the contents of a string is equal to the contents of
	 * a file (ignoring case).
	 *
	 * @param string $expectedFile Path to file with expected content.
	 * @param string $actualString Actual content.
	 * @param string $message      Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringEqualsFileIgnoringCase( $expectedFile, $actualString, $message = '' ) {
		static::assertStringEqualsFile( $expectedFile, $actualString, $message, false, true );
	}

	/**
	 * Asserts that the contents of a string is not equal to the contents of
	 * a file (canonicalizing).
	 *
	 * @param string $expectedFile Path to file with expected content.
	 * @param string $actualString Actual content.
	 * @param string $message      Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringNotEqualsFileCanonicalizing( $expectedFile, $actualString, $message = '' ) {
		static::assertStringNotEqualsFile( $expectedFile, $actualString, $message, true );
	}

	/**
	 * Asserts that the contents of a string is not equal to the contents of
	 * a file (ignoring case).
	 *
	 * @param string $expectedFile Path to file with expected content.
	 * @param string $actualString Actual content.
	 * @param string $message      Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertStringNotEqualsFileIgnoringCase( $expectedFile, $actualString, $message = '' ) {
		static::assertStringNotEqualsFile( $expectedFile, $actualString, $message, false, true );
	}
}
