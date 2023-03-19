<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

/**
 * Polyfill the `TestCase::expectDeprecation*()`, `TestCase::expectNotice*()`,
 * `TestCase::expectWarning*()` and `TestCase::expectError*()` methods
 * as alternative to using `TestCase::expectException*()` for PHP native messages.
 *
 * Introduced in PHPUnit 8.4.0.
 * Use of `TestCase::expectException()` et al for expecting PHP native errors, warnings and notices was
 * soft deprecated in PHPUnit 8.4.0, hard deprecated in PHPUnit 9.0.0 and (will be) removed in PHPUnit 10.0.0.
 *
 * @link https://github.com/sebastianbergmann/phpunit/issues/3775
 * @link https://github.com/sebastianbergmann/phpunit/issues/3776
 * @link https://github.com/sebastianbergmann/phpunit/issues/3777
 */
trait ExpectPHPException {

	/**
	 * Set expectation for receiving a PHP native deprecation notice.
	 *
	 * @return void
	 */
	public function expectDeprecation() {
		$this->expectException( '\PHPUnit\Framework\Error\Deprecated' );
	}

	/**
	 * Set expectation for the message when receiving a PHP native deprecation notice.
	 *
	 * @param string $message The message to expect.
	 *
	 * @return void
	 */
	public function expectDeprecationMessage( $message ) {
		$this->expectExceptionMessage( $message );
	}

	/**
	 * Set expectation for the message when receiving a PHP native deprecation notice (regex based).
	 *
	 * @param string $regularExpression A regular expression which must match the message.
	 *
	 * @return void
	 */
	public function expectDeprecationMessageMatches( $regularExpression ) {
		$this->expectExceptionMessageRegExp( $regularExpression );
	}

	/**
	 * Set expectation for receiving a PHP native notice.
	 *
	 * @return void
	 */
	public function expectNotice() {
		$this->expectException( '\PHPUnit\Framework\Error\Notice' );
	}

	/**
	 * Set expectation for the message when receiving a PHP native notice.
	 *
	 * @param string $message The message to expect.
	 *
	 * @return void
	 */
	public function expectNoticeMessage( $message ) {
		$this->expectExceptionMessage( $message );
	}

	/**
	 * Set expectation for the message when receiving a PHP native notice (regex based).
	 *
	 * @param string $regularExpression A regular expression which must match the message.
	 *
	 * @return void
	 */
	public function expectNoticeMessageMatches( $regularExpression ) {
		$this->expectExceptionMessageRegExp( $regularExpression );
	}

	/**
	 * Set expectation for receiving a PHP native warning.
	 *
	 * @return void
	 */
	public function expectWarning() {
		$this->expectException( '\PHPUnit\Framework\Error\Warning' );
	}

	/**
	 * Set expectation for the message when receiving a PHP native warning.
	 *
	 * @param string $message The message to expect.
	 *
	 * @return void
	 */
	public function expectWarningMessage( $message ) {
		$this->expectExceptionMessage( $message );
	}

	/**
	 * Set expectation for the message when receiving a PHP native warning (regex based).
	 *
	 * @param string $regularExpression A regular expression which must match the message.
	 *
	 * @return void
	 */
	public function expectWarningMessageMatches( $regularExpression ) {
		$this->expectExceptionMessageRegExp( $regularExpression );
	}

	/**
	 * Set expectation for receiving a PHP native error.
	 *
	 * @return void
	 */
	public function expectError() {
		$this->expectException( '\PHPUnit\Framework\Error\Error' );
	}

	/**
	 * Set expectation for the message when receiving a PHP native error.
	 *
	 * @param string $message The message to expect.
	 *
	 * @return void
	 */
	public function expectErrorMessage( $message ) {
		$this->expectExceptionMessage( $message );
	}

	/**
	 * Set expectation for the message when receiving a PHP native error (regex based).
	 *
	 * @param string $regularExpression A regular expression which must match the message.
	 *
	 * @return void
	 */
	public function expectErrorMessageMatches( $regularExpression ) {
		$this->expectExceptionMessageRegExp( $regularExpression );
	}
}
