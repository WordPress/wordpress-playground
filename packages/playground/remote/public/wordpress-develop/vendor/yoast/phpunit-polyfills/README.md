PHPUnit Polyfills
=====================================================

[![Version](https://poser.pugx.org/yoast/phpunit-polyfills/version)](//packagist.org/packages/yoast/phpunit-polyfills)
[![CS Build Status](https://github.com/Yoast/PHPUnit-Polyfills/actions/workflows/cs.yml/badge.svg)](https://github.com/Yoast/PHPUnit-Polyfills/actions/workflows/cs.yml)
[![Lint Build Status](https://github.com/Yoast/PHPUnit-Polyfills/actions/workflows/lint.yml/badge.svg)](https://github.com/Yoast/PHPUnit-Polyfills/actions/workflows/lint.yml)
[![Test Build Status](https://github.com/Yoast/PHPUnit-Polyfills/actions/workflows/test.yml/badge.svg)](https://github.com/Yoast/PHPUnit-Polyfills/actions/workflows/test.yml)
[![Minimum PHP Version](https://img.shields.io/packagist/php-v/yoast/phpunit-polyfills.svg?maxAge=3600)](https://packagist.org/packages/yoast/phpunit-polyfills)
[![License: BSD3](https://poser.pugx.org/yoast/phpunit-polyfills/license)](https://github.com/Yoast/PHPUnit-Polyfills/blob/main/LICENSE)


Set of polyfills for changed PHPUnit functionality to allow for creating PHPUnit cross-version compatible tests.

* [Requirements](#requirements)
    - [Autoloading](#autoloading)
* [Installation](#installation)
* [Why use the PHPUnit Polyfills?](#why-use-the-phpunit-polyfills)
* [Using this library](#using-this-library)
* [Features](#features)
    - [Polyfill traits](#polyfill-traits)
    - [Helper traits](#helper-traits)
    - [TestCases](#testcases)
    - [TestListener](#testlistener)
* [Frequently Asked Questions](#frequently-asked-questions)
* [Contributing](#contributing)
* [License](#license)


Requirements
------------

* PHP 5.4 or higher.
* [PHPUnit] 4.8 - 9.x (automatically required via Composer).

[PHPUnit]: https://packagist.org/packages/phpunit/phpunit


Installation
------------

To install this package, run:
```bash
composer require --dev yoast/phpunit-polyfills
```

To update this package, run:
```bash
composer update --dev yoast/phpunit-polyfills --with-dependencies
```

### Autoloading

Make sure to:
* Either use the Composer `vendor/autoload.php` file _as_ your test bootstrap file;
* Or require the `vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php` file _in_ your test bootstrap.


Why use the PHPUnit Polyfills?
------------------------------

This library is set up to allow for creating PHPUnit cross-version compatible tests by offering a number of polyfills for functionality which was introduced, split up or renamed in PHPUnit.

### Write your tests for PHPUnit 9.x and run them on PHPUnit 4.8 - 9.x

The polyfills have been setup to allow tests to be _forward_-compatible. What that means is, that your tests can use the assertions supported by the _latest_ PHPUnit version, even when running on older PHPUnit versions.

This puts the burden of upgrading to use the syntax of newer PHPUnit versions at the point when you want to _start_ running your tests on a newer version.
By doing so, dropping support for an older PHPUnit version becomes as straight-forward as removing it from the version constraint in your `composer.json` file.


Using this library
------------------

Each of the polyfills and helpers has been setup as a trait and can be imported and `use`d in any test file which extends the PHPUnit native `TestCase` class.

If the polyfill is not needed for the particular PHPUnit version on which the tests are being run, the autoloader
will automatically load an empty trait with that same name, so you can safely use these traits in tests which
need to be PHPUnit cross-version compatible.

```php
<?php

namespace Vendor\YourPackage\Tests;

use PHPUnit\Framework\TestCase;
use Yoast\PHPUnitPolyfills\Polyfills\AssertIsType;

class FooTest extends TestCase
{
    use AssertIsType;

    public function testSomething()
    {
        $this->assertIsBool( $maybeBool );
        self::assertIsNotIterable( $maybeIterable );
    }
}
```

Alternatively, you can use one of the [`TestCase` classes](#testcases) provided by this library instead of using the PHPUnit native `TestCase` class.

In that case, all polyfills and helpers will be available whenever needed.

```php
<?php

namespace Vendor\YourPackage\Tests;

use Yoast\PHPUnitPolyfills\TestCases\TestCase;

class FooTest extends TestCase
{
    public function testSomething()
    {
        $this->assertIsBool( $maybeBool );
        self::assertMatchesRegularExpression( $pattern, $string, $message );
    }
}
```

### Supported ways of calling the assertions

By default, PHPUnit supports [four ways of calling assertions]:
1. **As a method in the `TestCase` class - `$this->assertSomething()`.**
2. **Statically as a method in the `TestCase` class - `self/static/parent::assertSomething()`.**
3. Statically as a method of the `Assert` class - `Assert::assertSomething()`.
4. As a global function - `assertSomething()`.

The polyfills in this library support the first two ways of calling the assertions as those are the most commonly used type of assertion calls.

For the polyfills to work, a test class is **required** to be a (grand-)child of the PHPUnit native `TestCase` class.

[four ways of calling assertions]: https://phpunit.readthedocs.io/en/main/assertions.html#static-vs-non-static-usage-of-assertion-methods

### Use with PHPUnit < 5.7.0

If your library still needs to support PHP < 5.6 and therefore needs PHPUnit 4 for testing, there are a few caveats when using the traits stand-alone as we then enter "double-polyfill" territory.

To prevent _"conflicting method names"_ errors when a trait is `use`d multiple times in a class, the traits offered here do not attempt to solve this.

You will need to make sure to `use` any additional traits needed for the polyfills to work.

| PHPUnit   | When `use`-ing this trait       | You also need to `use` this trait |
|-----------|---------------------------------|-----------------------------------|
| 4.8 < 5.2 | `ExpectExceptionObject`         | `ExpectException`                 |
| 4.8 < 5.2 | `ExpectPHPException`            | `ExpectException`                 |
| 4.8 < 5.2 | `ExpectExceptionMessageMatches` | `ExpectException`                 |
| 4.8 < 5.6 | `AssertionRenames`              | `AssertFileDirectory`             |

_**Note: this only applies to the stand-alone use of the traits. The [`TestCase` classes](#testcases) provided by this library already take care of this automatically.**_

Code example testing for a PHP native warning in a test which needs to be able to run on PHPUnit 4.8:
```php
<?php

namespace Vendor\YourPackage\Tests;

use PHPUnit\Framework\TestCase;
use Yoast\PHPUnitPolyfills\Polyfills\ExpectException;
use Yoast\PHPUnitPolyfills\Polyfills\ExpectPHPException;

class FooTest extends TestCase
{
    use ExpectException;
    use ExpectPHPException;

    public function testSomething()
    {
        $this->expectWarningMessage( 'A non-numeric value encountered' );
    }
}
```


Features
--------

### Polyfill traits

#### PHPUnit < 5.0.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertNumericType`

Polyfills the following methods:
|                            |                              |                         |
|----------------------------|------------------------------|-------------------------|
| [`Assert::assertFinite()`] | [`Assert::assertInfinite()`] | [`Assert::assertNan()`] |

These methods were introduced in PHPUnit 5.0.0.

[`Assert::assertFinite()`]:   https://phpunit.readthedocs.io/en/main/assertions.html#assertinfinite
[`Assert::assertInfinite()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertinfinite
[`Assert::assertNan()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertnan

#### PHPUnit < 5.2.0: `Yoast\PHPUnitPolyfills\Polyfills\ExpectException`

Polyfills the following methods:
|                                     |                                              |
|-------------------------------------|----------------------------------------------|
| [`TestCase::expectException()`]     | [`TestCase::expectExceptionMessage()`]       |
| [`TestCase::expectExceptionCode()`] | [`TestCase::expectExceptionMessageRegExp()`] |

These methods were introduced in PHPUnit 5.2.0 as alternatives to the `Testcase::setExpectedException()` method which was deprecated in PHPUnit 5.2.0 and the `Testcase::setExpectedExceptionRegExp()` method which was deprecated in 5.6.0.
Both these methods were removed in PHPUnit 6.0.0.

[`TestCase::expectException()`]:              https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-exceptions
[`TestCase::expectExceptionMessage()`]:       https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-exceptions
[`TestCase::expectExceptionCode()`]:          https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-exceptions
[`TestCase::expectExceptionMessageRegExp()`]: https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-exceptions

#### PHPUnit < 5.6.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertFileDirectory`

Polyfills the following methods:
|                                         |                                            |
|-----------------------------------------|--------------------------------------------|
| [`Assert::assertIsReadable()`]          | [`Assert::assertNotIsReadable()`]          |
| [`Assert::assertIsWritable()`]          | [`Assert::assertNotIsWritable()`]          |
| [`Assert::assertDirectoryExists()`]     | [`Assert::assertDirectoryNotExists()`]     |
| [`Assert::assertDirectoryIsReadable()`] | [`Assert::assertDirectoryNotIsReadable()`] |
| [`Assert::assertDirectoryIsWritable()`] | [`Assert::assertDirectoryNotIsWritable()`] |
| [`Assert::assertFileIsReadable()`]      | [`Assert::assertFileNotIsReadable()`]      |
| [`Assert::assertFileIsWritable()`]      | [`Assert::assertFileNotIsWritable()`]      |

These methods were introduced in PHPUnit 5.6.0.

[`Assert::assertIsReadable()`]:             https://phpunit.readthedocs.io/en/main/assertions.html#assertisreadable
[`Assert::assertNotIsReadable()`]:          https://phpunit.readthedocs.io/en/main/assertions.html#assertisreadable
[`Assert::assertIsWritable()`]:             https://phpunit.readthedocs.io/en/main/assertions.html#assertiswritable
[`Assert::assertNotIsWritable()`]:          https://phpunit.readthedocs.io/en/main/assertions.html#assertiswritable
[`Assert::assertDirectoryExists()`]:        https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryexists
[`Assert::assertDirectoryNotExists()`]:     https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryexists
[`Assert::assertDirectoryIsReadable()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryisreadable
[`Assert::assertDirectoryNotIsReadable()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryisreadable
[`Assert::assertDirectoryIsWritable()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryiswritable
[`Assert::assertDirectoryNotIsWritable()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryiswritable
[`Assert::assertFileIsReadable()`]:         https://phpunit.readthedocs.io/en/main/assertions.html#assertfileisreadable
[`Assert::assertFileNotIsReadable()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertfileisreadable
[`Assert::assertFileIsWritable()`]:         https://phpunit.readthedocs.io/en/main/assertions.html#assertfileiswritable
[`Assert::assertFileNotIsWritable()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertfileiswritable

#### PHPUnit < 6.4.0: `Yoast\PHPUnitPolyfills\Polyfills\ExpectExceptionObject`

Polyfills the [`TestCase::expectExceptionObject()`] method to test all aspects of an `Exception` by passing an object to the method.

This method was introduced in PHPUnit 6.4.0.

[`TestCase::expectExceptionObject()`]: https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-exceptions

#### PHPUnit < 7.5.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertIsType`

Polyfills the following methods:
|                                   |                                   |                                 |
|-----------------------------------|-----------------------------------|---------------------------------|
| [`Assert::assertIsArray()`]       | [`Assert::assertIsBool()`]        | [`Assert::assertIsFloat()`]     |
| [`Assert::assertIsInt()`]         | [`Assert::assertIsNumeric()`]     | [`Assert::assertIsObject()`]    |
| [`Assert::assertIsResource()`]    | [`Assert::assertIsString()`]      | [`Assert::assertIsScalar()`]    |
| [`Assert::assertIsCallable()`]    | [`Assert::assertIsIterable()`]    |                                 |
| [`Assert::assertIsNotArray()`]    | [`Assert::assertIsNotBool()`]     | [`Assert::assertIsNotFloat()`]  |
| [`Assert::assertIsNotInt()`]      | [`Assert::assertIsNotNumeric()`]  | [`Assert::assertIsNotObject()`] |
| [`Assert::assertIsNotResource()`] | [`Assert::assertIsNotString()`]   | [`Assert::assertIsNotScalar()`] |
| [`Assert::assertIsNotCallable()`] | [`Assert::assertIsNotIterable()`] |                                 |

These methods were introduced in PHPUnit 7.5.0 as alternatives to the `Assert::assertInternalType()` and `Assert::assertNotInternalType()` methods, which were soft deprecated in PHPUnit 7.5.0, hard deprecated (warning) in PHPUnit 8.0.0 and removed in PHPUnit 9.0.0.

[`Assert::assertIsArray()`]:       https://phpunit.readthedocs.io/en/main/assertions.html#assertisarray
[`Assert::assertIsNotArray()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertisarray
[`Assert::assertIsBool()`]:        https://phpunit.readthedocs.io/en/main/assertions.html#assertisbool
[`Assert::assertIsNotBool()`]:     https://phpunit.readthedocs.io/en/main/assertions.html#assertisbool
[`Assert::assertIsFloat()`]:       https://phpunit.readthedocs.io/en/main/assertions.html#assertisfloat
[`Assert::assertIsNotFloat()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertisfloat
[`Assert::assertIsInt()`]:         https://phpunit.readthedocs.io/en/main/assertions.html#assertisint
[`Assert::assertIsNotInt()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertisint
[`Assert::assertIsNumeric()`]:     https://phpunit.readthedocs.io/en/main/assertions.html#assertisnumeric
[`Assert::assertIsNotNumeric()`]:  https://phpunit.readthedocs.io/en/main/assertions.html#assertisnumeric
[`Assert::assertIsObject()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertisobject
[`Assert::assertIsNotObject()`]:   https://phpunit.readthedocs.io/en/main/assertions.html#assertisobject
[`Assert::assertIsResource()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertisresource
[`Assert::assertIsNotResource()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertisresource
[`Assert::assertIsString()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertisstring
[`Assert::assertIsNotString()`]:   https://phpunit.readthedocs.io/en/main/assertions.html#assertisstring
[`Assert::assertIsScalar()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertisscalar
[`Assert::assertIsNotScalar()`]:   https://phpunit.readthedocs.io/en/main/assertions.html#assertisscalar
[`Assert::assertIsCallable()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertiscallable
[`Assert::assertIsNotCallable()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertiscallable
[`Assert::assertIsIterable()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertisiterable
[`Assert::assertIsNotIterable()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertisiterable

#### PHPUnit < 7.5.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertStringContains`

Polyfills the following methods:
|                                                      |                                                         |
|------------------------------------------------------|---------------------------------------------------------|
| [`Assert::assertStringContainsString()`]             | [`Assert::assertStringNotContainsString()`]             |
| [`Assert::assertStringContainsStringIgnoringCase()`] | [`Assert::assertStringNotContainsStringIgnoringCase()`] |

These methods were introduced in PHPUnit 7.5.0 as alternatives to using `Assert::assertContains()` and `Assert::assertNotContains()` with string haystacks. Passing string haystacks to these methods was soft deprecated in PHPUnit 7.5.0, hard deprecated (warning) in PHPUnit 8.0.0 and removed in PHPUnit 9.0.0.

[`Assert::assertStringContainsString()`]:                https://phpunit.readthedocs.io/en/main/assertions.html#assertstringcontainsstring
[`Assert::assertStringNotContainsString()`]:             https://phpunit.readthedocs.io/en/main/assertions.html#assertstringcontainsstring
[`Assert::assertStringContainsStringIgnoringCase()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertstringcontainsstringignoringcase
[`Assert::assertStringNotContainsStringIgnoringCase()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertstringcontainsstringignoringcase

#### PHPUnit < 7.5.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertEqualsSpecializations`

Polyfills the following methods:
|                                          |                                             |
|------------------------------------------|---------------------------------------------|
| [`Assert::assertEqualsCanonicalizing()`] | [`Assert::assertNotEqualsCanonicalizing()`] |
| [`Assert::assertEqualsIgnoringCase()`]   | [`Assert::assertNotEqualsIgnoringCase()`]   |
| [`Assert::assertEqualsWithDelta()`]      | [`Assert::assertNotEqualsWithDelta()`]      |

These methods were introduced in PHPUnit 7.5.0 as alternatives to using `Assert::assertEquals()` and `Assert::assertNotEquals()` with these optional parameters. Passing the respective optional parameters to these methods was soft deprecated in PHPUnit 7.5.0, hard deprecated (warning) in PHPUnit 8.0.0 and removed in PHPUnit 9.0.0.

[`Assert::assertEqualsCanonicalizing()`]:    https://phpunit.readthedocs.io/en/main/assertions.html#assertequalscanonicalizing
[`Assert::assertNotEqualsCanonicalizing()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertequalscanonicalizing
[`Assert::assertEqualsIgnoringCase()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertequalsignoringcase
[`Assert::assertNotEqualsIgnoringCase()`]:   https://phpunit.readthedocs.io/en/main/assertions.html#assertequalsignoringcase
[`Assert::assertEqualsWithDelta()`]:         https://phpunit.readthedocs.io/en/main/assertions.html#assertequalswithdelta
[`Assert::assertNotEqualsWithDelta()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertequalswithdelta

#### PHPUnit < 8.4.0: `Yoast\PHPUnitPolyfills\Polyfills\ExpectPHPException`

Polyfills the following methods:
|                                     |                                |                                       |
|-------------------------------------|--------------------------------|---------------------------------------|
| `TestCase::`[`expectError()`]       | [`expectErrorMessage()`]       | [`expectErrorMessageMatches()`]       |
| `TestCase::`[`expectWarning()`]     | [`expectWarningMessage()`]     | [`expectWarningMessageMatches()`]     |
| `TestCase::`[`expectNotice()`]      | [`expectNoticeMessage()`]      | [`expectNoticeMessageMatches()`]      |
| `TestCase::`[`expectDeprecation()`] | [`expectDeprecationMessage()`] | [`expectDeprecationMessageMatches()`] |

These methods were introduced in PHPUnit 8.4.0 as alternatives to using `TestCase::expectException()` et al for expecting PHP native errors, warnings and notices.
Using `TestCase::expectException*()` for testing PHP native notices was soft deprecated in PHPUnit 8.4.0, hard deprecated (warning) in PHPUnit 9.0.0 and (will be) removed in PHPUnit 10.0.0.

[`expectError()`]:                     https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectErrorMessage()`]:              https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectErrorMessageMatches()`]:       https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectWarning()`]:                   https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectWarningMessage()`]:            https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectWarningMessageMatches()`]:     https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectNotice()`]:                    https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectNoticeMessage()`]:             https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectNoticeMessageMatches()`]:      https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectDeprecation()`]:               https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectDeprecationMessage()`]:        https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices
[`expectDeprecationMessageMatches()`]: https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-php-errors-warnings-and-notices

#### PHPUnit < 8.4.0: `Yoast\PHPUnitPolyfills\Polyfills\ExpectExceptionMessageMatches`

Polyfills the [`TestCase::expectExceptionMessageMatches()`] method.

This method was introduced in PHPUnit 8.4.0 to improve the name of the `TestCase::expectExceptionMessageRegExp()` method.
The `TestCase::expectExceptionMessageRegExp()` method was soft deprecated in PHPUnit 8.4.0, hard deprecated (warning) in PHPUnit 8.5.3 and removed in PHPUnit 9.0.0.

[`TestCase::expectExceptionMessageMatches()`]: https://phpunit.readthedocs.io/en/main/writing-tests-for-phpunit.html#testing-exceptions

#### PHPUnit < 8.5.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertFileEqualsSpecializations`

Polyfills the following methods:
|                                                  |                                                     |
|--------------------------------------------------|-----------------------------------------------------|
| `Assert::assertFileEqualsCanonicalizing()`       | `Assert::assertFileNotEqualsCanonicalizing()`       |
| `Assert::assertFileEqualsIgnoringCase()`         | `Assert::assertFileNotEqualsIgnoringCase()`         |
| `Assert::assertStringEqualsFileCanonicalizing()` | `Assert::assertStringNotEqualsFileCanonicalizing()` |
| `Assert::assertStringEqualsFileIgnoringCase()`   | `Assert::assertStringNotEqualsFileIgnoringCase()`   |

These methods were introduced in PHPUnit 8.5.0 as alternatives to using `Assert::assertFileEquals()` and `Assert::assertFileNotEquals()` with these optional parameters. Passing the respective optional parameters to these methods was hard deprecated in PHPUnit 8.5.0 and removed in PHPUnit 9.0.0.

<!--
COMMENT: No documentation available (yet) for these assertions on the PHPUnit site.
-->

#### PHPUnit < 9.0.0: `Yoast\PHPUnitPolyfills\Polyfills\EqualToSpecializations`

Polyfills the following methods:
|                                   |                                 |
|-----------------------------------|---------------------------------|
| `Assert::equalToCanonicalizing()` | `Assert::equalToIgnoringCase()` |
| `Assert::equalToWithDelta()`      |                                 |

These methods, which are typically used to verify parameters passed to Mock Objects, were introduced in PHPUnit 9.0.0 as alternatives to using `Assert::EqualTo()` with these optional parameters. Support for passing the respective optional parameters to `Assert::EqualTo()` was removed in PHPUnit 9.0.0.

#### PHPUnit < 9.1.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertionRenames`

Polyfills the following renamed methods:
* [`Assert::assertIsNotReadable()`], introduced as alternative for `Assert::assertNotIsReadable()`.
* [`Assert::assertIsNotWritable()`], introduced as alternative for `Assert::assertNotIsWritable()`.
* [`Assert::assertDirectoryDoesNotExist()`], introduced as alternative for `Assert::assertDirectoryNotExists()`.
* [`Assert::assertDirectoryIsNotReadable()`], introduced as alternative for `Assert::assertDirectoryNotIsReadable()`.
* [`Assert::assertDirectoryIsNotWritable()`], introduced as alternative for `Assert::assertDirectoryNotIsWritable()`.
* [`Assert::assertFileDoesNotExist()`], introduced as alternative for `Assert::assertFileNotExists()`.
* [`Assert::assertFileIsNotReadable()`], introduced as alternative for `Assert::assertFileNotIsReadable()`.
* [`Assert::assertFileIsNotWritable()`], introduced as alternative for `Assert::assertFileNotIsWritable()`.
* [`Assert::assertMatchesRegularExpression()`], introduced as alternative for `Assert::assertRegExp()`.
* [`Assert::assertDoesNotMatchRegularExpression()`], introduced as alternative for `Assert::assertNotRegExp()`.

These methods were introduced in PHPUnit 9.1.0.
The original methods these new methods replace were hard deprecated in PHPUnit 9.1.0 and (will be) removed in PHPUnit 10.0.0.

[`Assert::assertIsNotReadable()`]:                 https://phpunit.readthedocs.io/en/main/assertions.html#assertisreadable
[`Assert::assertIsNotWritable()`]:                 https://phpunit.readthedocs.io/en/main/assertions.html#assertiswritable
[`Assert::assertDirectoryDoesNotExist()`]:         https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryexists
[`Assert::assertDirectoryIsNotReadable()`]:        https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryisreadable
[`Assert::assertDirectoryIsNotWritable()`]:        https://phpunit.readthedocs.io/en/main/assertions.html#assertdirectoryiswritable
[`Assert::assertFileDoesNotExist()`]:              https://phpunit.readthedocs.io/en/main/assertions.html#assertfileexists
[`Assert::assertFileIsNotReadable()`]:             https://phpunit.readthedocs.io/en/main/assertions.html#assertfileisreadable
[`Assert::assertFileIsNotWritable()`]:             https://phpunit.readthedocs.io/en/main/assertions.html#assertfileiswritable
[`Assert::assertMatchesRegularExpression()`]:      https://phpunit.readthedocs.io/en/main/assertions.html#assertmatchesregularexpression
[`Assert::assertDoesNotMatchRegularExpression()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertmatchesregularexpression

#### PHPUnit < 9.3.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertClosedResource`

Polyfills the following methods:
|                                    |                                       |
|------------------------------------|---------------------------------------|
| `Assert::assertIsClosedResource()` | `Assert::assertIsNotClosedResource()` |

These methods were introduced in PHPUnit 9.3.0.

<!--
COMMENT: No documentation available (yet) for these assertions on the PHPUnit site.
-->

Additionally, this trait contains a helper method `shouldClosedResourceAssertionBeSkipped()`.

Due to some bugs in PHP itself, the "is closed resource" determination cannot always be done reliably, most notably for the `libxml` extension.

This helper function can determine whether or not the current "value under test" in combination with the PHP version on which the test is being run is affected by these bugs.

> :warning: The PHPUnit native implementation of these assertions is also affected by these bugs!
The `shouldClosedResourceAssertionBeSkipped()` helper method is therefore available cross-version.

Usage examples:
```php
// Example: skipping the test completely.
if ( $this->shouldClosedResourceAssertionBeSkipped( $actual ) === true ) {
    $this->markTestSkipped('assertIs[Not]ClosedResource() cannot determine whether this resource is'
        . ' open or closed due to bugs in PHP (PHP ' . \PHP_VERSION . ').');
}

// Example: selectively skipping the assertion.
if ( self::shouldClosedResourceAssertionBeSkipped( $actual ) === false ) {
    $this->assertIsClosedResource( $actual );
}
```

> :point_right: While this polyfill is tested extensively, testing for these kind of bugs _exhaustively_ is _hard_.
> Please [report any bugs](https://github.com/Yoast/PHPUnit-Polyfills/issues/new/choose) found and include a clear code sample to reproduce the issue.

#### PHPUnit < 9.4.0: `Yoast\PHPUnitPolyfills\Polyfills\AssertObjectEquals`

Polyfills the [`Assert::assertObjectEquals()`] method to verify two (value) objects are considered equal.
This assertion expects an object to contain a comparator method in the object itself. This comparator method is subsequently called to verify the "equalness" of the objects.

The `assertObjectEquals()` assertion was introduced in PHPUnit 9.4.0.

> :information_source: Due to [limitations in how this assertion is implemented in PHPUnit] itself, it is currently not possible to create a single comparator method which will be compatible with both PHP < 7.0 and PHP 7.0 or higher.
>
> In effect two declarations of the same object would be needed to be compatible with PHP < 7.0 and PHP 7.0 and higher and still allow for testing the object using the `assertObjectEquals()` assertion.
>
> Due to this limitation, it is recommended to only use this assertion if the minimum supported PHP version of a project is PHP 7.0 or higher; or if the project does not run its tests on PHPUnit >= 9.4.0.
>
> The implementation of this assertion in the Polyfills is PHP cross-version compatible.

[limitations in how this assertion is implemented in PHPUnit]: https://github.com/sebastianbergmann/phpunit/issues/4707

[`Assert::assertObjectEquals()`]: https://phpunit.readthedocs.io/en/main/assertions.html#assertobjectequals


### Helper traits

#### `Yoast\PHPUnitPolyfills\Helpers\AssertAttributeHelper`

Helper to work around the removal of the `assertAttribute*()` methods.

The `assertAttribute*()` methods were deprecated in PHPUnit 8.0.0 and removed in PHPUnit 9.0.0.

Public properties can still be tested by accessing them directly:
```php
$this->assertSame( 'value', $obj->propertyName );
```

Protected and private properties can no longer be tested using PHPUnit native functionality.
The reasoning for the removal of these assertion methods is that _private and protected properties are an implementation detail and should not be tested directly, but via methods in the class_.

It is strongly recommended to refactor your tests, and if needs be, your classes to adhere to this.

However, if for some reason the value of `protected` or `private` properties still needs to be tested, this helper can be used to get access to their value and attributes.

The trait contains two helper methods:
* `public static getProperty( object $classInstance, string $propertyName ) : ReflectionProperty`
* `public static getPropertyValue( object $classInstance, string $propertyName ) : mixed`

```php
// Test the value of a protected or private property.
$this->assertSame( 'value', $this->getPropertyValue( $objInstance, $propertyName ) );

// Retrieve a ReflectionProperty object to test other details of the property.
self::assertSame( $propertyName, self::getProperty( $objInstance, $propertyName )->getName() );
```

### TestCases

PHPUnit 8.0.0 introduced a `void` return type declaration to the ["fixture" methods] - `setUpBeforeClass()`, `setUp()`, `tearDown()` and `tearDownAfterClass()`.
As the `void` return type was not introduced until PHP 7.1, this makes it more difficult to create cross-version compatible tests when using fixtures, due to signature mismatches.

["fixture" methods]: https://phpunit.readthedocs.io/en/main/fixtures.html

This library contains two basic `TestCase` options to overcome this issue.

#### Option 1: `Yoast\PHPUnitPolyfills\TestCases\TestCase`

This `TestCase` overcomes the signature mismatch by having two versions. The correct one will be loaded depending on the PHPUnit version being used.

When using this `TestCase`, if an individual test, or another `TestCase` which extends this `TestCase`, needs to overload any of the "fixture" methods, it should do so by using a snake_case variant of the original fixture method name, i.e. `set_up_before_class()`, `set_up()`, `assert_pre_conditions()`, `assert_post_conditions()`, `tear_down()` and `tear_down_after_class()`.

The snake_case methods will automatically be called by PHPUnit.

> **IMPORTANT:** The snake_case methods should **not** call the PHPUnit parent, i.e. do **not** use `parent::setUp()` from within an overloaded `set_up()` method.
> If necessary, _DO_ call `parent::set_up()`.

```php
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

class MyTest extends TestCase {
    public static function set_up_before_class() {
        parent::set_up_before_class();

        // Set up a database connection or other fixture which needs to be available.
    }

    protected function set_up() {
        parent::set_up();

        // Set up function mocks which need to be available for all tests in this class.
    }

    protected function assert_pre_conditions() {
        parent::assert_pre_conditions();

        // Perform assertions shared by all tests of a test case (before the test).
    }

    protected function assert_post_conditions() {
        // Performs assertions shared by all tests of a test case (after the test).

        parent::assert_post_conditions();
    }

    protected function tear_down() {
        // Any clean up needed related to `set_up()`.

        parent::tear_down();
    }

    public static function tear_down_after_class() {
        // Close database connection and other clean up related to `set_up_before_class()`.

        parent::tear_down_after_class();
    }
}
```

#### Option 2: `Yoast\PHPUnitPolyfills\TestCases\XTestCase`

This `TestCase` overcomes the signature mismatch by using the PHPUnit `@before[Class]` and `@after[Class]` annotations in combination with different methods names, i.e. `setUpFixturesBeforeClass()`, `setUpFixtures()`, `tearDownFixtures()` and `tearDownFixturesAfterClass()`.

When using this TestCase, overloaded fixture methods need to use the [`@beforeClass`], [`@before`], [`@after`] and [`@afterClass`] annotations.
The naming of the overloaded methods is open as long as the method names don't conflict with the PHPUnit native method names.

[`@beforeClass`]: https://phpunit.readthedocs.io/en/main/annotations.html#beforeclass
[`@before`]:      https://phpunit.readthedocs.io/en/main/annotations.html#before
[`@after`]:       https://phpunit.readthedocs.io/en/main/annotations.html#after
[`@afterClass`]:  https://phpunit.readthedocs.io/en/main/annotations.html#afterclass

```php
use Yoast\PHPUnitPolyfills\TestCases\XTestCase;

class MyTest extends XTestCase {
    /**
     * @beforeClass
     */
    public static function setUpFixturesBeforeClass() {
        parent::setUpFixturesBeforeClass();

        // Set up a database connection or other fixture which needs to be available.
    }

    /**
     * @before
     */
    protected function setUpFixtures() {
        parent::setUpFixtures();

        // Set up function mocks which need to be available for all tests in this class.
    }

    /**
     * @after
     */
    protected function tearDownFixtures() {
        // Any clean up needed related to `setUpFixtures()`.

        parent::tearDownFixtures();
    }

    /**
     * @afterClass
     */
    public static function tearDownFixturesAfterClass() {
        // Close database connection and other clean up related to `setUpFixturesBeforeClass()`.

        parent::tearDownFixturesAfterClass();
    }
}
```

### TestListener

The method signatures in the PHPUnit `TestListener` interface have changed a number of times across versions.
Additionally, the use of the TestListener principle has been deprecated in PHPUnit 7 in favour of using the [TestRunner hook interfaces](https://phpunit.readthedocs.io/en/9.3/extending-phpunit.html#extending-the-testrunner).

> Note: while deprecated in PHPUnit 7, the TestListener interface has not yet been removed and is still supported in PHPUnit 9.x.

If your test suite does not need to support PHPUnit < 7, it is strongly recommended to use the TestRunner hook interfaces extensions instead.

However, for test suites that still need to support PHPUnit 6 or lower, implementing the `TestListener` interface is the only viable option.

#### `Yoast\PHPUnitPolyfills\TestListeners\TestListenerDefaultImplementation`

This `TestListenerDefaultImplementation` trait overcomes the signature mismatches by having multiple versions and loading the correct one depending on the PHPUnit version being used.

Similar to the `TestCase` implementation, snake_case methods without type declarations are used to get round the signature mismatches. The snake_case methods will automatically be called.

| PHPUnit native method name | Replacement                             | Notes                                     |
|----------------------------|-----------------------------------------|-------------------------------------------|
| `addError()`               | `add_error($test, $e, $time)`           |                                           |
| `addWarning()`             | `add_warning($test, $e, $time)`         | Introduced in PHPUnit 6.                  |
| `addFailure()`             | `add_failure($test, $e, $time)`         |                                           |
| `addIncompleteTest()`      | `add_incomplete_test($test, $e, $time)` |                                           |
| `addRiskyTest()`           | `add_risky_test($test, $e, $time)`      | Support appears to be flaky on PHPUnit 5. |
| `addSkippedTest()`         | `add_skipped_test($test, $e, $time)`    |                                           |
| `startTestSuite()`         | `start_test_suite($suite)`              |                                           |
| `endTestSuite()`           | `end_test_suite($suite)`                |                                           |
| `startTest()`              | `start_test($test)`                     |                                           |
| `endTest()`                | `end_test($test, $time)`                |                                           |

Implementations of the `TestListener` interface may be using any of the following patterns:
```php
// PHPUnit < 6.
class MyTestListener extends \PHPUnit_Framework_BaseTestListener {}

// PHPUnit 6.
class MyTestListener extends \PHPUnit\Framework\BaseTestListener {}

// PHPUnit 7+.
class MyTestListener implements \PHPUnit\Framework\TestListener {
    use \PHPUnit\Framework\TestListenerDefaultImplementation;
}
```

Replace these with:
```php
use PHPUnit\Framework\TestListener;
use Yoast\PHPUnitPolyfills\TestListeners\TestListenerDefaultImplementation;

class MyTestListener implements TestListener {
    use TestListenerDefaultImplementation;

    // Implement any of the snakecase methods, for example:
    public function add_error( $test, $e, $time ) {
        // Do something when PHPUnit encounters an error.
    }
}
```


Frequently Asked Questions
--------------------------

### Q: Will this package polyfill functionality which was removed from PHPUnit ?

As a rule of thumb, removed functionality will **not** be polyfilled in this package.

For frequently used, removed PHPUnit functionality, "helpers" may be provided. These _helpers_ are only intended as an interim solution to allow users of this package more time to refactor their tests away from the removed functionality.

#### Removed functionality without PHPUnit native replacement

| PHPUnit | Removed               | Issue     | Remarks                |
|---------|-----------------------|-----------|------------------------|
| 9.0.0   | `assertArraySubset()` | [#1](https://github.com/Yoast/PHPUnit-Polyfills/issues/1) | The [`dms/phpunit-arraysubset-asserts`](https://packagist.org/packages/dms/phpunit-arraysubset-asserts) package polyfills this functionality.<br/>As of [version 0.3.0](https://github.com/rdohms/phpunit-arraysubset-asserts/releases/tag/v0.3.0) this package can be installed in combination with PHP 5.4 - current and PHPUnit 4.8.36/5.7.21 - current.<br/>Alternatively, tests can be refactored using the patterns outlined in [issue #1](https://github.com/Yoast/PHPUnit-Polyfills/issues/1).
| 9.0.0   | `assertAttribute*()`  | [#2](https://github.com/Yoast/PHPUnit-Polyfills/issues/2) | Refactor the tests to not directly test private/protected properties.<br/>As an interim solution, the [`Yoast\PHPUnitPolyfills\Helpers\AssertAttributeHelper`](#yoastphpunitpolyfillshelpersassertattributehelper) trait is available.


### Q: Can this library be used when the tests are being run via a PHPUnit Phar file ?

Yes, this package can also be used when running tests via a PHPUnit Phar file.

In that case, make sure that the `phpunitpolyfills-autoload.php` file is explicitly `require`d in the test bootstrap file.
(Not necessary when the Composer `vendor/autoload.php` file is used as, or `require`d in, the test bootstrap.)


### Q: How do I run my tests when the library is installed via the GitHub Actions `setup-php` action ?

As of [shivammathur/setup-php](https://github.com/shivammathur/setup-php) version [2.15.0](https://github.com/shivammathur/setup-php/releases/tag/2.15.0), the PHPUnit Polyfills are available as one of the tools which can be installed directly by the Setup-PHP GitHub action.

```yaml
- name: Setup PHP with tools
  uses: shivammathur/setup-php@v2
  with:
    php-version: '8.0'
    tools: phpunit-polyfills
```

The above step will install both the PHPUnit Polyfills, as well as PHPUnit, as Composer global packages.

After this step has run, you can run PHPUnit, like you would normally, by using `phpunit`.
```yaml
- name: Run tests
  run: phpunit
```

:point_right: If you rely on Composer for autoloading your project files, you will still need to run `composer dump-autoload --dev` and include the project local `vendor/autoload.php` file as/in your test bootstrap.

> :mortar_board: Why this works:
>
> Composer will place all files in the global Composer `bin` directory in the system path and the Composer installed PHPUnit version will load the Composer global `autoload.php` file, which will automatically also load the PHPUnit Polyfills.

Now you may wonder, _"what about if I explicitly request both `phpunit` as well as `phpunit-polyfills` in `tools`?"_

In that case, when you run `phpunit`, the PHPUnit PHAR will not know how to locate the PHPUnit Polyfills, so you will need to do some wizardry in your test bootstrap to get things working.


### Q: How can I verify the version used of the PHPUnit Polyfills library ?

For complex test setups, like when the Polyfills are provided via a test suite dependency, or may already be loaded via an overarching project, it can be useful to be able to check that a version of the package is used which complies with the requirements for your test suite.

As of version 1.0.1, the PHPUnit Polyfills `Autoload` class contains a version number which can be used for this purpose.

Typically such a check would be done in the test suite bootstrap file and could look something like this:
```php
if ( class_exists( '\Yoast\PHPUnitPolyfills\Autoload' ) === false ) {
    require_once 'vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
}

$versionRequirement = '1.0.1';
if ( defined( '\Yoast\PHPUnitPolyfills\Autoload::VERSION' ) === false
    || version_compare( \Yoast\PHPUnitPolyfills\Autoload::VERSION, $versionRequirement, '<' )
) {
    echo 'Error: Version mismatch detected for the PHPUnit Polyfills. Please ensure that PHPUnit Polyfills ',
        $versionRequirement, ' or higher is loaded.', PHP_EOL;
    exit(1);
} else {
    echo 'Error: Please run `composer update -W` before running the tests.' . PHP_EOL;
    echo 'You can still use a PHPUnit phar to run them, but the dependencies do need to be installed.', PHP_EOL;
    exit(1);
}
```


Contributing
------------
Contributions to this project are welcome. Clone the repo, branch off from `develop`, make your changes, commit them and send in a pull request.

If you are unsure whether the changes you are proposing would be welcome, please open an issue first to discuss your proposal.


License
-------
This code is released under the [BSD-3-Clause License](https://opensource.org/licenses/BSD-3-Clause).
