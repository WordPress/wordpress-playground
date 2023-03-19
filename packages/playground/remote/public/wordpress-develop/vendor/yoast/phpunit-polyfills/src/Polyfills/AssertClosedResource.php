<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

use PHPUnit\SebastianBergmann\Exporter\Exporter as Exporter_In_Phar;
use SebastianBergmann\Exporter\Exporter;
use Yoast\PHPUnitPolyfills\Helpers\ResourceHelper;

/**
 * Polyfill the Assert::assertIsClosedResource() and Assert::assertIsNotClosedResource() methods.
 *
 * Introduced in PHPUnit 9.3.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/issues/4276
 * @link https://github.com/sebastianbergmann/phpunit/pull/4365
 */
trait AssertClosedResource {

	/**
	 * Asserts that a variable is of type resource and is closed.
	 *
	 * @param mixed  $actual  The variable to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsClosedResource( $actual, $message = '' ) {
		if ( $message === '' ) {
			$exporter = \class_exists( 'SebastianBergmann\Exporter\Exporter' ) ? new Exporter() : new Exporter_In_Phar();
			$message  = \sprintf( 'Failed asserting that %s is of type "resource (closed)"', $exporter->export( $actual ) );
		}

		static::assertTrue( ResourceHelper::isClosedResource( $actual ), $message );
	}

	/**
	 * Asserts that a variable is not of type resource or is an open resource.
	 *
	 * @param mixed  $actual  The variable to test.
	 * @param string $message Optional failure message to display.
	 *
	 * @return void
	 */
	public static function assertIsNotClosedResource( $actual, $message = '' ) {
		if ( $message === '' ) {
			$exporter = \class_exists( 'SebastianBergmann\Exporter\Exporter' ) ? new Exporter() : new Exporter_In_Phar();
			$type     = $exporter->export( $actual );
			if ( $type === 'NULL' ) {
				$type = 'resource (closed)';
			}
			$message = \sprintf( 'Failed asserting that %s is not of type "resource (closed)"', $type );
		}

		static::assertFalse( ResourceHelper::isClosedResource( $actual ), $message );
	}

	/**
	 * Helper function to determine whether an assertion regarding a resource's state should be skipped.
	 *
	 * Due to some bugs in PHP itself, the "is closed resource" determination
	 * cannot always be done reliably.
	 *
	 * This method can determine whether or not the current value in combination with
	 * the current PHP version on which the test is being run is affected by this.
	 *
	 * Use this function to skip running a test using `assertIs[Not]ClosedResource()` or
	 * to skip running just that particular assertion.
	 *
	 * @param mixed $actual The variable to test.
	 *
	 * @return bool
	 */
	public static function shouldClosedResourceAssertionBeSkipped( $actual ) {
		return ( ResourceHelper::isResourceStateReliable( $actual ) === false );
	}
}
