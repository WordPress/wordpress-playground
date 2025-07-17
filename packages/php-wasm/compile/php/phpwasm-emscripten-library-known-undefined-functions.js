/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php_<major>_<minor>.js" files and implements JavaScript functions
 * that can be called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

// Explicitly declare known, accepted undefined functions. By doing this,
// we can enable compiler warnings for unexpected undefined symbols.
var knownUndefinedFunctions = [
	// Functions used by PHP for fibers but not supported by Emscripten by default.
	// https://github.com/php/php-src/blob/747851724efcdae1502040eec4787fa7b911b6bf/Zend/zend_fibers.c#L517
	'getcontext',
	'makecontext',
	'swapcontext',

	// Used by PHP when attempting direct access to file descriptors.
	// Not currently included in our build by Emscripten.
	// If we encounter a need for it, let's investigate and fix this.
	// https://github.com/php/php-src/blob/747851724efcdae1502040eec4787fa7b911b6bf/ext/standard/php_fopen_wrapper.c#L321
	'getdtablesize',
];

var LibraryKnownUndefinedFunctions = {};
for (const name of knownUndefinedFunctions) {
	LibraryKnownUndefinedFunctions[name] = () => abort('missing function: ${name}');
}
mergeInto(LibraryManager.library, LibraryKnownUndefinedFunctions);
