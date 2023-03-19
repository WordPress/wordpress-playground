# Change Log for Yoast PHPUnit Polyfills

All notable changes to this project will be documented in this file.

This projects adheres to [Keep a CHANGELOG](http://keepachangelog.com/) and uses [Semantic Versioning](http://semver.org/).


## [Unreleased]

_Nothing yet._

## [1.0.4] - 2022-11-16

This is a maintenance release.

### Changed
* The `Yoast\PHPUnitPolyfills\Autoload` class is now `final`. PR [#77].
* README: clear up minor language confusion. Props [Phil E. Taylor] and [fredericgboutin-yapla] for pointing it out.
* README: fix links which were broken due to an upstream branch rename. PR [#80].
* Verified PHP 8.2 compatibility.
* General housekeeping.

[#77]: https://github.com/Yoast/PHPUnit-Polyfills/pull/77
[#80]: https://github.com/Yoast/PHPUnit-Polyfills/pull/80


## [1.0.3] - 2021-11-23

### Changed
* General housekeeping.

### Fixed
* The failure message thrown for the `assertIsClosedResource()` and `assertIsNotClosedResource()` assertions will now be more informative, most notably, when the value under test _is_ a closed resource. PR [#65], props [Alain Schlesser] for reporting.

[#65]: https://github.com/Yoast/PHPUnit-Polyfills/pull/65


## [1.0.2] - 2021-10-03

As of version 2.15.0 of the `shivammathur/setup-php` action for GitHub Actions, the PHPUnit Polyfills can be installed directly from this action using the `tools` key.

### Added
* README: FAQ section about installing and using the library via the `shivammathur/setup-php` action. PR [#52]

### Changed
* README: minor textual clarifications and improvements. PRs [#52], [#54], props [Pierre Gordon].
* General housekeeping.

### Fixed
* Autoloader: improved compatibility with packages which create a `class_alias` for the `PHPUnit_Runner_Version` or `PHPUnit\Runner\Version` class. PR [#59]

[#52]: https://github.com/Yoast/PHPUnit-Polyfills/pull/52
[#54]: https://github.com/Yoast/PHPUnit-Polyfills/pull/54
[#59]: https://github.com/Yoast/PHPUnit-Polyfills/pull/59


## [1.0.1] - 2021-08-09

### Added
* The `Yoast\PHPUnitPolyfills\Autoload` class now contains a `VERSION` constant. Issue [#46], PR [#47], props [Pascal Birchler] for the suggestion.
    This version constant can be used by (complex) test setups to verify that the PHPUnit Polyfills which will be loaded, comply with the version requirements for the test suite.

### Changed
* Minor documentation updates. [#43]

[#43]: https://github.com/Yoast/PHPUnit-Polyfills/pull/43
[#46]: https://github.com/Yoast/PHPUnit-Polyfills/issues/46
[#47]: https://github.com/Yoast/PHPUnit-Polyfills/pull/47


## [1.0.0] - 2021-06-21

### Added
* `Yoast\PHPUnitPolyfills\Polyfills\AssertClosedResource` trait to polyfill the `Assert::assertIsClosedResource()` and `Assert::assertIsNotClosedResource()` methods as introduced in PHPUnit 9.3.0. PR [#27].
* `Yoast\PHPUnitPolyfills\Polyfills\AssertObjectEquals` trait to polyfill the `Assert::assertObjectEquals()` method as introduced in PHPUnit 9.4.0. PR [#38].
    The behaviour of the polyfill closely matches the PHPUnit native implementation, but is not 100% the same.
    Most notably, the polyfill will check the type of the returned value from the comparator method instead of enforcing a return type declaration for the comparator method.
* `Yoast\PHPUnitPolyfills\Polyfills\EqualToSpecializations` trait to polyfill the `Assert::equalToCanonicalizing()`, `Assert::equalToIgnoringCase()` and `Assert::equalToWithDelta()` methods as introduced in PHPUnit 9.0.0. PR [#28], props [Marc Siegrist].
* Polyfills for the PHP native `Error` and `TypeError` classes as introduced in PHP 7.0. PR [#36].
* README: FAQ section covering functionality removed from PHPUnit and usage with a Phar.

### Changed
* The minimum supported PHP version has been lowered to PHP 5.4 (was 5.5). PR [#19].
* `XTestCase`: the visibility of the `setUpFixtures()` and the `tearDownFixtures()` methods has been changed to `protected` (was `public`). Issue [#10], PR [#20], props [Mark Baker] for reporting.
* README: re-ordered the sections and various other improvements.
* Initial preparation for PHPUnit 10.0 compatibility.
* General housekeeping.

### Fixed
* Issue [#17] via PR [#18] - `AssertStringContainString`: PHPUnit < 6.4.2 would throw a _"mb_strpos(): empty delimiter"_ PHP warning when the `$needle` passed was an empty string. Props [Gary Jones].

[#10]: https://github.com/Yoast/PHPUnit-Polyfills/issues/10
[#17]: https://github.com/Yoast/PHPUnit-Polyfills/issues/17
[#18]: https://github.com/Yoast/PHPUnit-Polyfills/pull/18
[#19]: https://github.com/Yoast/PHPUnit-Polyfills/pull/19
[#20]: https://github.com/Yoast/PHPUnit-Polyfills/pull/20
[#27]: https://github.com/Yoast/PHPUnit-Polyfills/pull/27
[#28]: https://github.com/Yoast/PHPUnit-Polyfills/pull/28
[#36]: https://github.com/Yoast/PHPUnit-Polyfills/pull/36
[#38]: https://github.com/Yoast/PHPUnit-Polyfills/pull/38


## [0.2.0] - 2020-11-25

### Added
* `Yoast\PHPUnitPolyfills\TestListeners\TestListenerDefaultImplementation`: a cross-version compatible base implementation for `TestListener`s using snake_case method names to replace the PHPUnit native method names.
* `Yoast\PHPUnitPolyfills\Helpers\AssertAttributeHelper` trait containing a `getProperty()` and a `getPropertyValue()` method.
    This is a stop-gap solution for the removal of the PHPUnit `assertAttribute*()` methods in PHPUnit 9.
    It is strongly recommended to refactor your tests/classes in a way that protected and private properties no longer be tested directly as they should be considered an implementation detail.
    However, if for some reason the value of protected or private properties still needs to be tested, this helper can be used to get access to their value.
* `Yoast\PHPUnitPolyfills\Polyfills\AssertNumericType` trait to polyfill the `Assert::assertFinite()`, `Assert::assertInfinite()` and `Assert::assertNan()` methods as introduced in PHPUnit 5.0.0.
* `Yoast\PHPUnitPolyfills\Polyfills\ExpectException` trait to polyfill the `TestCase::expectException()`, `TestCase::expectExceptionMessage()`, `TestCase::expectExceptionCode()` and `TestCase::expectExceptionMessageRegExp()` methods, as introduced in PHPUnit 5.2.0 to replace the `Testcase::setExpectedException()` and the `Testcase::setExpectedExceptionRegExp()` method.
* `Yoast\PHPUnitPolyfills\Polyfills\AssertFileDirectory` trait to polyfill the `Assert::assertIsReadable()`, `Assert::assertIsWritable()` methods and their file/directory based variations, as introduced in PHPUnit 5.6.0.
* `Yoast\PHPUnitPolyfills\TestCases\TestCase`: support for the `assertPreConditions()` and `assertPostConditions()` methods.

### Changed
* The minimum supported PHP version has been lowered to PHP 5.5 (was 5.6).
* The minimum supported PHPUnit version has been lowered to PHP 4.8.36 (was 5.7).
    Note: for PHPUnit 4, only version 4.8.36 is supported, for PHPUnit 5, only PHPUnit >= 5.7.21 is supported.
* Readme: documentation improvements.


## [0.1.0] - 2020-10-26

Initial release.


[Unreleased]: https://github.com/Yoast/PHPUnit-Polyfills/compare/main...HEAD
[1.0.4]: https://github.com/Yoast/PHPUnit-Polyfills/compare/1.0.3...1.0.4
[1.0.3]: https://github.com/Yoast/PHPUnit-Polyfills/compare/1.0.2...1.0.3
[1.0.2]: https://github.com/Yoast/PHPUnit-Polyfills/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/Yoast/PHPUnit-Polyfills/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/Yoast/PHPUnit-Polyfills/compare/0.2.0...1.0.0
[0.2.0]: https://github.com/Yoast/PHPUnit-Polyfills/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/Yoast/PHPUnit-Polyfills/compare/e8f8b7a73737aa9a5974bd9c73d2bd8d09f69873...0.1.0

[Alain Schlesser]: https://github.com/schlessera
[fredericgboutin-yapla]: https://github.com/fredericgboutin-yapla
[Gary Jones]: https://github.com/GaryJones
[Marc Siegrist]: https://github.com/mergeMarc
[Mark Baker]: https://github.com/MarkBaker
[Pascal Birchler]: https://github.com/swissspidy
[Phil E. Taylor]: https://github.com/PhilETaylor
[Pierre Gordon]: https://github.com/pierlon
