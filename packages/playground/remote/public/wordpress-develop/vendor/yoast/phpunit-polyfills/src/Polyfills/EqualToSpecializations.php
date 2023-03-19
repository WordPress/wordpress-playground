<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

use PHPUnit\Framework\Constraint\IsEqual;

/**
 * Polyfill the Assert::equalToCanonicalizing(), Assert::equalToIgnoringCase() and
 * Assert::equalToWithDelta(), which replace the use of Assert::equalTo()
 * with these optional parameters.
 *
 * Introduced in PHPUnit 9.0.0.
 * Use of Assert::equalTo() with these respective optional parameters was
 * never deprecated but leads to unexpected behaviour as they are ignored in PHPUnit 9.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/commit/43c01a4e0c74a4bf019a8d879bced5146af2fbb6
 */
trait EqualToSpecializations {

	/**
	 * Creates "is equal" constraint (canonicalizing).
	 *
	 * @param mixed $value Expected value for constraint.
	 *
	 * @return IsEqual|PHPUnit_Framework_Constraint_IsEqual An isEqual constraint instance.
	 */
	public static function equalToCanonicalizing( $value ) {
		return static::equalTo( $value, 0.0, 10, true, false );
	}

	/**
	 * Creates "is equal" constraint (ignoring case).
	 *
	 * @param mixed $value Expected value for constraint.
	 *
	 * @return IsEqual|PHPUnit_Framework_Constraint_IsEqual An isEqual constraint instance.
	 */
	public static function equalToIgnoringCase( $value ) {
		return static::equalTo( $value, 0.0, 10, false, true );
	}

	/**
	 * Creates "is equal" constraint (with delta).
	 *
	 * @param mixed $value Expected value for constraint.
	 * @param float $delta The delta to allow between the expected and the actual value.
	 *
	 * @return IsEqual|PHPUnit_Framework_Constraint_IsEqual An isEqual constraint instance.
	 */
	public static function equalToWithDelta( $value, $delta ) {
		return static::equalTo( $value, $delta, 10, false, false );
	}
}
