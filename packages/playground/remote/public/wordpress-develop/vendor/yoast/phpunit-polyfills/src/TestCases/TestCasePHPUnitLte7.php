<?php

namespace Yoast\PHPUnitPolyfills\TestCases;

use PHPUnit\Framework\TestCase as PHPUnit_TestCase;
use Yoast\PHPUnitPolyfills\Helpers\AssertAttributeHelper;
use Yoast\PHPUnitPolyfills\Polyfills\AssertClosedResource;
use Yoast\PHPUnitPolyfills\Polyfills\AssertEqualsSpecializations;
use Yoast\PHPUnitPolyfills\Polyfills\AssertFileDirectory;
use Yoast\PHPUnitPolyfills\Polyfills\AssertFileEqualsSpecializations;
use Yoast\PHPUnitPolyfills\Polyfills\AssertionRenames;
use Yoast\PHPUnitPolyfills\Polyfills\AssertIsType;
use Yoast\PHPUnitPolyfills\Polyfills\AssertNumericType;
use Yoast\PHPUnitPolyfills\Polyfills\AssertObjectEquals;
use Yoast\PHPUnitPolyfills\Polyfills\AssertStringContains;
use Yoast\PHPUnitPolyfills\Polyfills\EqualToSpecializations;
use Yoast\PHPUnitPolyfills\Polyfills\ExpectException;
use Yoast\PHPUnitPolyfills\Polyfills\ExpectExceptionMessageMatches;
use Yoast\PHPUnitPolyfills\Polyfills\ExpectExceptionObject;
use Yoast\PHPUnitPolyfills\Polyfills\ExpectPHPException;

/**
 * Basic test case for use with PHPUnit <= 7.
 *
 * This test case uses renamed (snakecase) methods for the `setUpBeforeClass()`, `setUp()`,
 * `assertPreConditions()`, `assertPostConditions()`, `tearDown()` and `tearDownAfterClass()`
 * methods to get round the signature change in PHPUnit 8.
 *
 * When using this TestCase, the snakecase method names need to be used to overload a fixture method.
 */
abstract class TestCase extends PHPUnit_TestCase {

	use AssertAttributeHelper;
	use AssertClosedResource;
	use AssertEqualsSpecializations;
	use AssertFileDirectory;
	use AssertFileEqualsSpecializations;
	use AssertionRenames;
	use AssertIsType;
	use AssertNumericType;
	use AssertObjectEquals;
	use AssertStringContains;
	use EqualToSpecializations;
	use ExpectException;
	use ExpectExceptionMessageMatches;
	use ExpectExceptionObject;
	use ExpectPHPException;

	/**
	 * This method is called before the first test of this test class is run.
	 *
	 * @codeCoverageIgnore
	 *
	 * @return void
	 */
	public static function setUpBeforeClass() {
		parent::setUpBeforeClass();
		static::set_up_before_class();
	}

	/**
	 * Sets up the fixture, for example, open a network connection.
	 *
	 * This method is called before each test.
	 *
	 * @return void
	 */
	protected function setUp() {
		parent::setUp();
		$this->set_up();
	}

	/**
	 * Performs assertions shared by all tests of a test case.
	 *
	 * This method is called before the execution of a test starts and after setUp() is called.
	 *
	 * @return void
	 */
	protected function assertPreConditions() {
		parent::assertPreConditions();
		$this->assert_pre_conditions();
	}

	/**
	 * Performs assertions shared by all tests of a test case.
	 *
	 * This method is called before the execution of a test ends and before tearDown() is called.
	 *
	 * @return void
	 */
	protected function assertPostConditions() {
		parent::assertPostConditions();
		$this->assert_post_conditions();
	}

	/**
	 * Tears down the fixture, for example, close a network connection.
	 *
	 * This method is called after each test.
	 *
	 * @return void
	 */
	protected function tearDown() {
		$this->tear_down();
		parent::tearDown();
	}

	/**
	 * This method is called after the last test of this test class is run.
	 *
	 * @codeCoverageIgnore
	 *
	 * @return void
	 */
	public static function tearDownAfterClass() {
		static::tear_down_after_class();
		parent::tearDownAfterClass();
	}

	/**
	 * This method is called before the first test of this test class is run.
	 *
	 * @return void
	 */
	public static function set_up_before_class() {}

	/**
	 * Sets up the fixture, for example, open a network connection.
	 *
	 * This method is called before each test.
	 *
	 * @return void
	 */
	protected function set_up() {}

	/**
	 * Performs assertions shared by all tests of a test case.
	 *
	 * This method is called before the execution of a test starts and after set_up() is called.
	 *
	 * @return void
	 */
	protected function assert_pre_conditions() {}

	/**
	 * Performs assertions shared by all tests of a test case.
	 *
	 * This method is called before the execution of a test ends and before tear_down() is called.
	 *
	 * @return void
	 */
	protected function assert_post_conditions() {}

	/**
	 * Tears down the fixture, for example, close a network connection.
	 *
	 * This method is called after each test.
	 *
	 * @return void
	 */
	protected function tear_down() {}

	/**
	 * This method is called after the last test of this test class is run.
	 *
	 * @return void
	 */
	public static function tear_down_after_class() {}
}
