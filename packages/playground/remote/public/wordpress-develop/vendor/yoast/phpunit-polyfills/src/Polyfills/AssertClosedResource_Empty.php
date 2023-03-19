<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

use Yoast\PHPUnitPolyfills\Helpers\ResourceHelper;

/**
 * Empty trait for use with PHPUnit >= 9.3.0 in which the polyfill is not needed.
 *
 * For consistency, the "should this test be skipped" method is included
 * as the PHPUnit native versions of the `assertIs[Not]ClosedResource()`
 * assertions are affected by the same bugs.
 */
trait AssertClosedResource {

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
