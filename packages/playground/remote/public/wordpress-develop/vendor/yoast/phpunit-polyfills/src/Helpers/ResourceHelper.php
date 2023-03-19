<?php

namespace Yoast\PHPUnitPolyfills\Helpers;

use Exception;
use TypeError;

/**
 * Helper functions for working with the resource type.
 *
 * ---------------------------------------------------------------------------------------------
 * This class is only intended for internal use by PHPUnit Polyfills and is not part of the public API.
 * This also means that it has no promise of backward compatibility.
 *
 * End-user should use the {@see \Yoast\PHPUnitPolyfills\Polyfills\AssertClosedResource()} trait instead.
 * ---------------------------------------------------------------------------------------------
 *
 * @internal
 */
final class ResourceHelper {

	/**
	 * Determines whether a variable represents a resource, either open or closed.
	 *
	 * @param mixed $actual The variable to test.
	 *
	 * @return bool
	 */
	public static function isResource( $actual ) {
		return ( $actual !== null
			&& \is_scalar( $actual ) === false
			&& \is_array( $actual ) === false
			&& \is_object( $actual ) === false );
	}

	/**
	 * Determines whether a variable represents a closed resource.
	 *
	 * @param mixed $actual The variable to test.
	 *
	 * @return bool
	 */
	public static function isClosedResource( $actual ) {
		$type = \gettype( $actual );

		/*
		 * PHP 7.2 introduced "resource (closed)".
		 */
		if ( $type === 'resource (closed)' ) {
			return true;
		}

		/*
		 * If gettype did not work, attempt to determine whether this is
		 * a closed resource in another way.
		 */
		$isResource       = \is_resource( $actual );
		$isNotNonResource = self::isResource( $actual );

		if ( $isResource === false && $isNotNonResource === true ) {
			return true;
		}

		if ( $isNotNonResource === true ) {
			try {
				$resourceType = @\get_resource_type( $actual );
				if ( $resourceType === 'Unknown' ) {
					return true;
				}
			} catch ( TypeError $e ) {
				// Ignore. Not a resource.
			} catch ( Exception $e ) {
				// Ignore. Not a resource.
			}
		}

		return false;
	}

	/**
	 * Helper function to determine whether the open/closed state of a resource is reliable.
	 *
	 * Due to some bugs in PHP itself, the "is closed resource" determination
	 * cannot always be done reliably.
	 *
	 * This function can determine whether or not the current value in combination with
	 * the current PHP version on which the test is being run is affected by this.
	 *
	 * @param mixed $actual The variable to test.
	 *
	 * @return bool
	 */
	public static function isResourceStateReliable( $actual ) {
		try {
			$type = @\get_resource_type( $actual );

			if ( $type === 'xml' && self::isIncompatiblePHPForLibXMLResources() === true ) {
				return false;
			}
		} catch ( TypeError $e ) {
			// Ignore. Not a resource.
		} catch ( Exception $e ) {
			// Ignore. Not a resource.
		}

		return true;
	}

	/**
	 * Check if the PHP version is one of a known set of PHP versions
	 * containing a libxml version which does not report on closed resources
	 * correctly.
	 *
	 * Version ranges based on {@link https://3v4l.org/tc4fE}.
	 * 7.0.8 - 7.0.33, 7.1.0 - 7.1.33, 7.2.0 - 7.2.34, 7.3.0 - 7.3.21, 7.4.0 - 7.4.9
	 *
	 * {@internal IMPORTANT: Any changes made to this function should also be made
	 * to the function in the "empty" version of this trait.}
	 *
	 * @return bool
	 */
	public static function isIncompatiblePHPForLibXMLResources() {
		if ( \PHP_VERSION_ID >= 70008 && \PHP_VERSION_ID < 70034 ) {
			return true;
		}

		if ( \PHP_VERSION_ID >= 70100 && \PHP_VERSION_ID < 70134 ) {
			return true;
		}

		if ( \PHP_VERSION_ID >= 70200 && \PHP_VERSION_ID < 70235 ) {
			return true;
		}

		if ( \PHP_VERSION_ID >= 70300 && \PHP_VERSION_ID < 70322 ) {
			return true;
		}

		if ( \PHP_VERSION_ID >= 70400 && \PHP_VERSION_ID < 70410 ) {
			return true;
		}

		return false;
	}
}
