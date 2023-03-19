<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

/**
 * Polyfill various assertions renamed for readability.
 *
 * Introduced in PHPUnit 9.1.0.
 * The old names were deprecated in PHPUnit 9.1.0 and (will be) removed in PHPUnit 10.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/issues/4061
 * @link https://github.com/sebastianbergmann/phpunit/issues/4062
 * @link https://github.com/sebastianbergmann/phpunit/issues/4063
 * @link https://github.com/sebastianbergmann/phpunit/issues/4064
 * @link https://github.com/sebastianbergmann/phpunit/issues/4065
 * @link https://github.com/sebastianbergmann/phpunit/issues/4066
 * @link https://github.com/sebastianbergmann/phpunit/issues/4067
 * @link https://github.com/sebastianbergmann/phpunit/issues/4068
 * @link https://github.com/sebastianbergmann/phpunit/issues/4069
 * @link https://github.com/sebastianbergmann/phpunit/issues/4070
 * @link https://github.com/sebastianbergmann/phpunit/issues/4071
 * @link https://github.com/sebastianbergmann/phpunit/issues/4072
 * @link https://github.com/sebastianbergmann/phpunit/issues/4073
 * @link https://github.com/sebastianbergmann/phpunit/issues/4074
 * @link https://github.com/sebastianbergmann/phpunit/issues/4075
 * @link https://github.com/sebastianbergmann/phpunit/issues/4076
 * @link https://github.com/sebastianbergmann/phpunit/issues/4077
 * @link https://github.com/sebastianbergmann/phpunit/issues/4078
 * @link https://github.com/sebastianbergmann/phpunit/issues/4079
 * @link https://github.com/sebastianbergmann/phpunit/issues/4080
 * @link https://github.com/sebastianbergmann/phpunit/issues/4081
 * @link https://github.com/sebastianbergmann/phpunit/issues/4082
 * @link https://github.com/sebastianbergmann/phpunit/issues/4083
 * @link https://github.com/sebastianbergmann/phpunit/issues/4084
 * @link https://github.com/sebastianbergmann/phpunit/issues/4085
 * @link https://github.com/sebastianbergmann/phpunit/issues/4086
 * @link https://github.com/sebastianbergmann/phpunit/issues/4087
 * @link https://github.com/sebastianbergmann/phpunit/issues/4088
 * @link https://github.com/sebastianbergmann/phpunit/issues/4089
 * @link https://github.com/sebastianbergmann/phpunit/issues/4090
 */
trait AssertionRenames {

	/**
	 * Asserts that a file/dir exists and is not readable.
	 *
	 * @param string $filename Path to the file/directory.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotReadable( $filename, $message = '' ) {
		static::assertNotIsReadable( $filename, $message );
	}

	/**
	 * Asserts that a file/dir exists and is not writable.
	 *
	 * @param string $filename Path to the file/directory.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotWritable( $filename, $message = '' ) {
		static::assertNotIsWritable( $filename, $message );
	}

	/**
	 * Asserts that a directory does not exist.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDirectoryDoesNotExist( $directory, $message = '' ) {
		static::assertDirectoryNotExists( $directory, $message );
	}

	/**
	 * Asserts that a directory exists and is not readable.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDirectoryIsNotReadable( $directory, $message = '' ) {
		static::assertDirectoryNotIsReadable( $directory, $message );
	}

	/**
	 * Asserts that a directory exists and is not writable.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDirectoryIsNotWritable( $directory, $message = '' ) {
		static::assertDirectoryNotIsWritable( $directory, $message );
	}

	/**
	 * Asserts that a file does not exist.
	 *
	 * @param string $filename Path to the file.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileDoesNotExist( $filename, $message = '' ) {
		static::assertFileNotExists( $filename, $message );
	}

	/**
	 * Asserts that a file exists and is not readable.
	 *
	 * @param string $file    Path to the file.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileIsNotReadable( $file, $message = '' ) {
		static::assertFileNotIsReadable( $file, $message );
	}

	/**
	 * Asserts that a file exists and is not writable.
	 *
	 * @param string $file    Path to the file.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileIsNotWritable( $file, $message = '' ) {
		static::assertFileNotIsWritable( $file, $message );
	}

	/**
	 * Asserts that a string matches a given regular expression.
	 *
	 * @param string $pattern Regular expression pattern.
	 * @param string $string  String to match against the regular expression.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertMatchesRegularExpression( $pattern, $string, $message = '' ) {
		static::assertRegExp( $pattern, $string, $message );
	}

	/**
	 * Asserts that a string does not match a given regular expression.
	 *
	 * @param string $pattern Regular expression pattern.
	 * @param string $string  String to match against the regular expression.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDoesNotMatchRegularExpression( $pattern, $string, $message = '' ) {
		static::assertNotRegExp( $pattern, $string, $message );
	}
}
