<?php

namespace Yoast\PHPUnitPolyfills\Helpers;

use ReflectionException;
use ReflectionObject;
use ReflectionProperty;

/**
 * Helper to work-around the removal of the `assertAttribute*()` methods.
 *
 * The `assertAttribute*()` methods were deprecated in PHPUnit 8.0.0 and
 * removed in PHPUnit 9.0.0.
 *
 * Public properties can still be tested by accessing them directly:
 * ```php
 * $this->assertSame( 'value', $obj->propertyName );
 * ```
 *
 * Protected and private properties can no longer be tested using PHPUnit native
 * functionality.
 * The reasoning for the removal of these assertion methods is that _private and
 * protected properties are an implementation detail and should not be tested
 * directly, but via methods in the class_.
 *
 * It is strongly recommended to refactor your tests, and if needs be, your classes
 * to adhere to this.
 *
 * However, if for some reason the value of protected or private properties still
 * needs to be tested, this helper can be used to get access to their value.
 * ```php
 * $this->assertSame( 'value', $this->getPropertyValue( $obj, $propertyName ) );
 * ```
 *
 * @since 0.2.0
 */
trait AssertAttributeHelper {

	/**
	 * Retrieve a private or protected property in an object.
	 *
	 * @param object $objInstance  The object.
	 * @param string $propertyName The name of property to retrieve.
	 *
	 * @return ReflectionProperty
	 *
	 * @throws ReflectionException When a non-existent property is requested.
	 */
	public static function getProperty( $objInstance, $propertyName ) {
		$reflect  = new ReflectionObject( $objInstance );
		$property = $reflect->getProperty( $propertyName );
		$property->setAccessible( true );

		return $property;
	}

	/**
	 * Retrieve the current value of a private or protected property in an object.
	 *
	 * @param object $objInstance  The object.
	 * @param string $propertyName The name of property for which to retrieve the value.
	 *
	 * @return mixed
	 */
	public static function getPropertyValue( $objInstance, $propertyName ) {
		$property = static::getProperty( $objInstance, $propertyName );

		return $property->getValue( $objInstance );
	}
}
