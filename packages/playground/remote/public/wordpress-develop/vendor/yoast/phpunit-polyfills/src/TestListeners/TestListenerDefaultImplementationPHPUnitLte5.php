<?php

namespace Yoast\PHPUnitPolyfills\TestListeners;

use Exception;
use PHPUnit_Framework_AssertionFailedError;
use PHPUnit_Framework_Test;
use PHPUnit_Framework_TestSuite;
use PHPUnit_Framework_Warning;

/**
 * Basic TestListener implementation for use with PHPUnit 4.x and 5.x.
 *
 * This TestListener trait uses renamed (snakecase) methods for all standard methods in
 * a TestListener to get round the method signature changes in various PHPUnit versions.
 *
 * When using this TestListener trait, the snake_case method names need to be used to implement
 * the listener functionality.
 *
 * {@internal While in essence this trait is no different from the PHPUnit 6.x version, this
 * version is necessary as the class/interface name type declarations used in the PHPUnit 6.x
 * file are based on the namespaced names. As both the namespaced names as well as the
 * non-namespaced names exist in PHPUnit 4.8.36+/5.7.21+, we cannot create class aliases to
 * get round the signature mismatch and need this trait using the old names instead.}
 */
trait TestListenerDefaultImplementation {

	use TestListenerSnakeCaseMethods;

	/**
	 * An error occurred.
	 *
	 * @param PHPUnit_Framework_Test $test Test object.
	 * @param Exception              $e    Instance of the error encountered.
	 * @param float                  $time Execution time of this test.
	 */
	public function addError( PHPUnit_Framework_Test $test, Exception $e, $time ) {
		$this->add_error( $test, $e, $time );
	}

	/**
	 * A warning occurred.
	 *
	 * This method is only functional in PHPUnit 6.0 and above.
	 *
	 * @param PHPUnit_Framework_Test    $test Test object.
	 * @param PHPUnit_Framework_Warning $e    Instance of the warning encountered.
	 * @param float                     $time Execution time of this test.
	 */
	public function addWarning( PHPUnit_Framework_Test $test, PHPUnit_Framework_Warning $e, $time ) {
		$this->add_warning( $test, $e, $time );
	}

	/**
	 * A failure occurred.
	 *
	 * @param PHPUnit_Framework_Test                 $test Test object.
	 * @param PHPUnit_Framework_AssertionFailedError $e    Instance of the assertion failure
	 *                                                     exception encountered.
	 * @param float                                  $time Execution time of this test.
	 */
	public function addFailure( PHPUnit_Framework_Test $test, PHPUnit_Framework_AssertionFailedError $e, $time ) {
		$this->add_failure( $test, $e, $time );
	}

	/**
	 * Incomplete test.
	 *
	 * @param PHPUnit_Framework_Test $test Test object.
	 * @param Exception              $e    Instance of the incomplete test exception.
	 * @param float                  $time Execution time of this test.
	 */
	public function addIncompleteTest( PHPUnit_Framework_Test $test, Exception $e, $time ) {
		$this->add_incomplete_test( $test, $e, $time );
	}

	/**
	 * Risky test.
	 *
	 * @param PHPUnit_Framework_Test $test Test object.
	 * @param Exception              $e    Instance of the risky test exception.
	 * @param float                  $time Execution time of this test.
	 */
	public function addRiskyTest( PHPUnit_Framework_Test $test, Exception $e, $time ) {
		$this->add_risky_test( $test, $e, $time );
	}

	/**
	 * Skipped test.
	 *
	 * @param PHPUnit_Framework_Test $test Test object.
	 * @param Exception              $e    Instance of the skipped test exception.
	 * @param float                  $time Execution time of this test.
	 */
	public function addSkippedTest( PHPUnit_Framework_Test $test, Exception $e, $time ) {
		$this->add_skipped_test( $test, $e, $time );
	}

	/**
	 * A test suite started.
	 *
	 * @param PHPUnit_Framework_TestSuite $suite Test suite object.
	 */
	public function startTestSuite( PHPUnit_Framework_TestSuite $suite ) {
		$this->start_test_suite( $suite );
	}

	/**
	 * A test suite ended.
	 *
	 * @param PHPUnit_Framework_TestSuite $suite Test suite object.
	 */
	public function endTestSuite( PHPUnit_Framework_TestSuite $suite ) {
		$this->end_test_suite( $suite );
	}

	/**
	 * A test started.
	 *
	 * @param PHPUnit_Framework_Test $test Test object.
	 */
	public function startTest( PHPUnit_Framework_Test $test ) {
		$this->start_test( $test );
	}

	/**
	 * A test ended.
	 *
	 * @param PHPUnit_Framework_Test $test Test object.
	 * @param float                  $time Execution time of this test.
	 */
	public function endTest( PHPUnit_Framework_Test $test, $time ) {
		$this->end_test( $test, $time );
	}
}
