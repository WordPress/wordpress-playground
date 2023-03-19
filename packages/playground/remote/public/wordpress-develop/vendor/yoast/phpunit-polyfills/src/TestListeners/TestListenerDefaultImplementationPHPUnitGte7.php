<?php

namespace Yoast\PHPUnitPolyfills\TestListeners;

use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\Test;
use PHPUnit\Framework\TestSuite;
use PHPUnit\Framework\Warning;
use Throwable;

/**
 * Basic TestListener implementation for use with PHPUnit >= 7.x.
 *
 * This TestListener trait uses renamed (snakecase) methods for all standard methods in
 * a TestListener to get round the method signature changes in various PHPUnit versions.
 *
 * When using this TestListener trait, the snake_case method names need to be used to implement
 * the listener functionality.
 */
trait TestListenerDefaultImplementation {

	use TestListenerSnakeCaseMethods;

	/**
	 * An error occurred.
	 *
	 * @param Test      $test Test object.
	 * @param Throwable $t    Instance of the error encountered.
	 * @param float     $time Execution time of this test.
	 */
	public function addError( Test $test, Throwable $t, float $time ): void {
		$this->add_error( $test, $t, $time );
	}

	/**
	 * A warning occurred.
	 *
	 * This method is only functional in PHPUnit 6.0 and above.
	 *
	 * @param Test    $test Test object.
	 * @param Warning $e    Instance of the warning encountered.
	 * @param float   $time Execution time of this test.
	 */
	public function addWarning( Test $test, Warning $e, float $time ): void {
		$this->add_warning( $test, $e, $time );
	}

	/**
	 * A failure occurred.
	 *
	 * @param Test                 $test Test object.
	 * @param AssertionFailedError $e    Instance of the assertion failure exception encountered.
	 * @param float                $time Execution time of this test.
	 */
	public function addFailure( Test $test, AssertionFailedError $e, float $time ): void {
		$this->add_failure( $test, $e, $time );
	}

	/**
	 * Incomplete test.
	 *
	 * @param Test      $test Test object.
	 * @param Throwable $t    Instance of the incomplete test exception.
	 * @param float     $time Execution time of this test.
	 */
	public function addIncompleteTest( Test $test, Throwable $t, float $time ): void {
		$this->add_incomplete_test( $test, $t, $time );
	}

	/**
	 * Risky test.
	 *
	 * @param Test      $test Test object.
	 * @param Throwable $t    Instance of the risky test exception.
	 * @param float     $time Execution time of this test.
	 */
	public function addRiskyTest( Test $test, Throwable $t, float $time ): void {
		$this->add_risky_test( $test, $t, $time );
	}

	/**
	 * Skipped test.
	 *
	 * @param Test      $test Test object.
	 * @param Throwable $t    Instance of the skipped test exception.
	 * @param float     $time Execution time of this test.
	 */
	public function addSkippedTest( Test $test, Throwable $t, float $time ): void {
		$this->add_skipped_test( $test, $t, $time );
	}

	/**
	 * A test suite started.
	 *
	 * @param TestSuite $suite Test suite object.
	 */
	public function startTestSuite( TestSuite $suite ): void {
		$this->start_test_suite( $suite );
	}

	/**
	 * A test suite ended.
	 *
	 * @param TestSuite $suite Test suite object.
	 */
	public function endTestSuite( TestSuite $suite ): void {
		$this->end_test_suite( $suite );
	}

	/**
	 * A test started.
	 *
	 * @param Test $test Test object.
	 */
	public function startTest( Test $test ): void {
		$this->start_test( $test );
	}

	/**
	 * A test ended.
	 *
	 * @param Test  $test Test object.
	 * @param float $time Execution time of this test.
	 */
	public function endTest( Test $test, float $time ): void {
		$this->end_test( $test, $time );
	}
}
