<?php

namespace Yoast\PHPUnitPolyfills\Polyfills;

use PHPUnit\Framework\Exception;
use PHPUnit_Util_InvalidArgumentHelper;

/**
 * Polyfill the TestCase::expectException*() methods.
 *
 * Introduced in PHPUnit 5.2.0 as a replacement for the `Testcase::setExpectedException() method which
 * was deprecated in PHPUnit 5.2.0 and the `Testcase::setExpectedExceptionRegExp()` method which was
 * deprecated in 5.6.0.
 * Both these methods were removed in PHPUnit 6.0.0.
 *
 * {@internal The `PHPUnit_Util_InvalidArgumentHelper` class is not aliased to its PHPUnit 6.x name,
 * as it is only needed and used in this class.
 * In contrast the `PHPUnit\Framework\Exception` class *is* aliased from within the autoloader as it
 * is also used in the tests, and may be used by tests implementing this framework.}
 *
 * @link https://github.com/sebastianbergmann/phpunit/commit/55d97d56696d5f6dee02732c08212ec519057803
 * @link https://github.com/sebastianbergmann/phpunit/commit/13305a6183ede02fc5d2f3534a93efac852813d5
 */
trait ExpectException {

	/**
	 * The message of the expected Exception.
	 *
	 * {@internal Note: Using a different name from the (private) PHPUnit native property on purpose.}
	 *
	 * @var string
	 */
	private $exceptionMessage = '';

	/**
	 * The code of the expected Exception.
	 *
	 * {@internal Note: Using a different name from the (private) PHPUnit native property on purpose.}
	 *
	 * @var int|null
	 */
	private $exceptionCode = null;

	/**
	 * Clear any stored exception information between each test.
	 *
	 * @after
	 */
	public function clearExceptionInfo() {
		$this->exceptionMessage = '';
		$this->exceptionCode    = null;
	}

	/**
	 * Set an expectation to receive a particular type of Exception.
	 *
	 * @param mixed $exception The name of the exception to expect.
	 *
	 * @return void
	 */
	public function expectException( $exception ) {
		$this->setExpectedException( $exception, $this->exceptionMessage, $this->exceptionCode );
	}

	/**
	 * Set an expectation to receive an Exception with a particular error code.
	 *
	 * @param int|string $code The error code to expect.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public function expectExceptionCode( $code ) {
		if ( ! \is_int( $code ) && ! \is_string( $code ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'integer or string' );
		}

		// Store the received code in case any of the other methods are called as well.
		$this->exceptionCode = $code;

		$exception = $this->getExpectedException();
		$this->setExpectedException( $exception, $this->exceptionMessage, $code );
	}

	/**
	 * Set an expectation to receive an Exception with a particular error message.
	 *
	 * @param string $message The error message to expect.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public function expectExceptionMessage( $message ) {
		if ( ! \is_string( $message ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		// Store the received message in case any of the other methods are called as well.
		$this->exceptionMessage = $message;

		$exception = $this->getExpectedException();
		$this->setExpectedException( $exception, $message, $this->exceptionCode );
	}

	/**
	 * Set an expectation that an Exception message matches a pattern as per the regular expression.
	 *
	 * @param string $messageRegExp The regular expression pattern which the message should comply with.
	 *
	 * @return void
	 *
	 * @throws Exception When the received parameter is not of the expected input type.
	 */
	public function expectExceptionMessageRegExp( $messageRegExp ) {
		if ( ! \is_string( $messageRegExp ) ) {
			throw PHPUnit_Util_InvalidArgumentHelper::factory( 1, 'string' );
		}

		$exception = $this->getExpectedException();
		$this->setExpectedExceptionRegExp( $exception, $messageRegExp, $this->exceptionCode );
	}
}
