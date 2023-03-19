<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

use Exception;

/**
 * Polyfill the TestCase::expectExceptionObject() method.
 *
 * Introduced in PHPUnit 6.4.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/pull/2780
 */
trait ExpectExceptionObject {

	/**
	 * Set expectations for an expected Exception based on an Exception object.
	 *
	 * @param Exception $exception Exception object.
	 *
	 * @return void
	 */
	public function expectExceptionObject( Exception $exception ) {
		$this->expectException( \get_class( $exception ) );
		$this->expectExceptionMessage( $exception->getMessage() );
		$this->expectExceptionCode( $exception->getCode() );
	}
}
