<?php

namespace Yoast\PHPUnitPolyfills\Exceptions;

use Exception;

/**
 * Exception used for all errors throw by the polyfill for the `assertObjectEquals()` assertion.
 *
 * PHPUnit natively throws a range of different exceptions.
 * The polyfill throws just one exception type with different messages.
 */
final class InvalidComparisonMethodException extends Exception {

	/**
	 * Convert the Exception object to a string message.
	 *
	 * @return string
	 */
	public function __toString() {
		return $this->getMessage() . \PHP_EOL;
	}
}
