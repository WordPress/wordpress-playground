<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

/**
 * Polyfill the TestCase::expectExceptionMessageMatches() method, which replaces
 * the TestCase::expectExceptionMessageRegExp() method.
 *
 * Introduced in PHPUnit 8.4.0.
 * The `TestCase::expectExceptionMessageRegExp()` method was soft deprecated in PHPUnit 8.4.0,
 * hard deprecated in PHPUnit 8.5.3 and removed in PHPUnit 9.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/commit/d1199cb2e43a934b51521656be9748f63febe18e
 * @link https://github.com/sebastianbergmann/phpunit/issues/4133
 * @link https://github.com/sebastianbergmann/phpunit/issues/3957
 */
trait ExpectExceptionMessageMatches {

	/**
	 * Set an expectation that an Exception message matches a pattern as per the regular expression.
	 *
	 * @param string $regularExpression The regular expression.
	 *
	 * @return void
	 */
	public function expectExceptionMessageMatches( $regularExpression ) {
		$this->expectExceptionMessageRegExp( $regularExpression );
	}
}
