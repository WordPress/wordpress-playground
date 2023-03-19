<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

use PHPUnit_Util_InvalidArgumentHelper;

/**
 * Polyfill the assertIsReadable(), assertNotIsReadable(), assertIsWritable(),
 * assertNotIsWritable(), assertDirectoryExists(), assertDirectoryNotExists(),
 * assertDirectoryIsReadable(), assertDirectoryNotIsReadable(), assertDirectoryIsWritable(),
 * assertDirectoryNotIsWritable(), assertFileIsReadable(), assertFileNotIsReadable(),
 * assertFileIsWritable(), and assertFileNotIsWritable() methods.
 *
 * Introduced in PHPUnit 5.6.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/pull/2262
 */
trait AssertFileDirectory {

	/**
	 * Asserts that a file/dir is readable.
	 *
	 * @param string $filename Path to the file.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public static function assertIsReadable( $filename, $message = '' ) {
		if ( ! \is_string( $filename ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		if ( $message === '' ) {
			$message = \sprintf( 'Failed asserting that "%s" is readable', $filename );
		}

		static::assertTrue( \is_readable( $filename ), $message );
	}

	/**
	 * Asserts that a file/dir exists and is not readable.
	 *
	 * @param string $filename Path to the file.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public static function assertNotIsReadable( $filename, $message = '' ) {
		if ( ! \is_string( $filename ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		if ( $message === '' ) {
			$message = \sprintf( 'Failed asserting that "%s" is not readable', $filename );
		}

		static::assertFalse( \is_readable( $filename ), $message );
	}

	/**
	 * Asserts that a file/dir exists and is writable.
	 *
	 * @param string $filename Path to the file.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public static function assertIsWritable( $filename, $message = '' ) {
		if ( ! \is_string( $filename ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		if ( $message === '' ) {
			$message = \sprintf( 'Failed asserting that "%s" is writable', $filename );
		}

		static::assertTrue( \is_writable( $filename ), $message );
	}

	/**
	 * Asserts that a file/dir exists and is not writable.
	 *
	 * @param string $filename Path to the file.
	 * @param string $message  Optional failure message to display.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public static function assertNotIsWritable( $filename, $message = '' ) {
		if ( ! \is_string( $filename ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		if ( $message === '' ) {
			$message = \sprintf( 'Failed asserting that "%s" is not writable', $filename );
		}

		static::assertFalse( \is_writable( $filename ), $message );
	}

	/**
	 * Asserts that a directory exists.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public static function assertDirectoryExists( $directory, $message = '' ) {
		if ( ! \is_string( $directory ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		if ( $message === '' ) {
			$message = \sprintf( 'Failed asserting that directory "%s" exists', $directory );
		}

		static::assertTrue( \is_dir( $directory ), $message );
	}

	/**
	 * Asserts that a directory does not exist.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public static function assertDirectoryNotExists( $directory, $message = '' ) {
		if ( ! \is_string( $directory ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		if ( $message === '' ) {
			$message = \sprintf( 'Failed asserting that directory "%s" does not exist', $directory );
		}

		static::assertFalse( \is_dir( $directory ), $message );
	}

	/**
	 * Asserts that a directory exists and is readable.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDirectoryIsReadable( $directory, $message = '' ) {
		static::assertDirectoryExists( $directory, $message );
		static::assertIsReadable( $directory, $message );
	}

	/**
	 * Asserts that a directory exists and is not readable.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDirectoryNotIsReadable( $directory, $message = '' ) {
		static::assertDirectoryExists( $directory, $message );
		static::assertNotIsReadable( $directory, $message );
	}

	/**
	 * Asserts that a directory exists and is writable.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDirectoryIsWritable( $directory, $message = '' ) {
		static::assertDirectoryExists( $directory, $message );
		static::assertIsWritable( $directory, $message );
	}

	/**
	 * Asserts that a directory exists and is not writable.
	 *
	 * @param string $directory Path to the directory.
	 * @param string $message   Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertDirectoryNotIsWritable( $directory, $message = '' ) {
		static::assertDirectoryExists( $directory, $message );
		static::assertNotIsWritable( $directory, $message );
	}

	/**
	 * Asserts that a file exists and is readable.
	 *
	 * @param string $file    Path to the file.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileIsReadable( $file, $message = '' ) {
		static::assertFileExists( $file, $message );
		static::assertIsReadable( $file, $message );
	}

	/**
	 * Asserts that a file exists and is not readable.
	 *
	 * @param string $file    Path to the file.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileNotIsReadable( $file, $message = '' ) {
		static::assertFileExists( $file, $message );
		static::assertNotIsReadable( $file, $message );
	}

	/**
	 * Asserts that a file exists and is writable.
	 *
	 * @param string $file    Path to the file.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileIsWritable( $file, $message = '' ) {
		static::assertFileExists( $file, $message );
		static::assertIsWritable( $file, $message );
	}

	/**
	 * Asserts that a file exists and is not writable.
	 *
	 * @param string $file    Path to the file.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertFileNotIsWritable( $file, $message = '' ) {
		static::assertFileExists( $file, $message );
		static::assertNotIsWritable( $file, $message );
	}
}
