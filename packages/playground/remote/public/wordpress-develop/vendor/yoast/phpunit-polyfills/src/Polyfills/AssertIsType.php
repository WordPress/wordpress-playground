<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

use Traversable;

/**
 * Polyfill the Assert::assertIsBool(), Assert::assertIsNotBool() etc methods, which
 * replace the Assert::assertInternalType() and Assert::assertNotInternalType() methods.
 *
 * Introduced in PHPUnit 7.5.0.
 * The Assert::assertInternalType() and Assert::assertNotInternalType() methods were
 * deprecated in PHPUnit 7.5.0 and removed in PHPUnit 9.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/issues/3368
 * @link https://github.com/sebastianbergmann/phpunit/issues/3369
 */
trait AssertIsType {

	/**
	 * Asserts that a variable is of type array.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsArray( $actual, $message = '' ) {
		static::assertInternalType( 'array', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type bool.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsBool( $actual, $message = '' ) {
		static::assertInternalType( 'bool', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type float.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsFloat( $actual, $message = '' ) {
		static::assertInternalType( 'float', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type int.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsInt( $actual, $message = '' ) {
		static::assertInternalType( 'int', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type numeric.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNumeric( $actual, $message = '' ) {
		static::assertInternalType( 'numeric', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type object.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsObject( $actual, $message = '' ) {
		static::assertInternalType( 'object', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type resource.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsResource( $actual, $message = '' ) {
		static::assertInternalType( 'resource', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type string.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsString( $actual, $message = '' ) {
		static::assertInternalType( 'string', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type scalar.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsScalar( $actual, $message = '' ) {
		static::assertInternalType( 'scalar', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type callable.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsCallable( $actual, $message = '' ) {
		static::assertInternalType( 'callable', $actual, $message );
	}

	/**
	 * Asserts that a variable is of type iterable.
	 *
	 * {@internal Support for `iterable` was only added to the `Assert::assertInternalType()` method
	 * in PHPUnit 7.1.0, so this polyfill can't use a direct fall-through to that functionality
	 * until the minimum supported PHPUnit version of this library would be PHPUnit 7.1.0.}
	 *
	 * @link https://github.com/sebastianbergmann/phpunit/pull/3035 PR which added support for `is_iterable`
	 *                                                              to `Assert::assertInternalType()`.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsIterable( $actual, $message = '' ) {
		if ( \function_exists( 'is_iterable' ) === true ) {
			// PHP >= 7.1.
			// phpcs:ignore PHPCompatibility.FunctionUse.NewFunctions.is_iterableFound
			static::assertTrue( \is_iterable( $actual ), $message );
		}
		else {
			// PHP < 7.1.
			$result = ( \is_array( $actual ) || $actual instanceof Traversable );
			static::assertTrue( $result, $message );
		}
	}

	/**
	 * Asserts that a variable is not of type array.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotArray( $actual, $message = '' ) {
		static::assertNotInternalType( 'array', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type bool.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotBool( $actual, $message = '' ) {
		static::assertNotInternalType( 'bool', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type float.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotFloat( $actual, $message = '' ) {
		static::assertNotInternalType( 'float', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type int.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotInt( $actual, $message = '' ) {
		static::assertNotInternalType( 'int', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type numeric.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotNumeric( $actual, $message = '' ) {
		static::assertNotInternalType( 'numeric', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type object.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotObject( $actual, $message = '' ) {
		static::assertNotInternalType( 'object', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type resource.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotResource( $actual, $message = '' ) {
		static::assertNotInternalType( 'resource', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type string.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotString( $actual, $message = '' ) {
		static::assertNotInternalType( 'string', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type scalar.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotScalar( $actual, $message = '' ) {
		static::assertNotInternalType( 'scalar', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type callable.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotCallable( $actual, $message = '' ) {
		static::assertNotInternalType( 'callable', $actual, $message );
	}

	/**
	 * Asserts that a variable is not of type iterable.
	 *
	 * {@internal Support for `iterable` was only added to the `Assert::assertNotInternalType()` method
	 * in PHPUnit 7.1.0, so this polyfill can't use a direct fall-through to that functionality
	 * until the minimum supported PHPUnit version of this library would be PHPUnit 7.1.0.}
	 *
	 * @link https://github.com/sebastianbergmann/phpunit/pull/3035 PR which added support for `is_iterable`
	 *                                                              to `Assert::assertNotInternalType()`.
	 *
	 * @param mixed  $actual  The value to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotIterable( $actual, $message = '' ) {
		if ( \function_exists( 'is_iterable' ) === true ) {
			// PHP >= 7.1.
			// phpcs:ignore PHPCompatibility.FunctionUse.NewFunctions.is_iterableFound
			static::assertFalse( \is_iterable( $actual ), $message );
		}
		else {
			// PHP < 7.1.
			$result = ( \is_array( $actual ) || $actual instanceof Traversable );
			static::assertFalse( $result, $message );
		}
	}
}
