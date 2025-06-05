/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php_<major>_<minor>.js" files and implements JavaScript functions
 * that can be called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

var LibraryForCustomDynamicLinking = {
	_dlopen_js: function __dlopen_js(handle) {
		var jsflags = { loadAsync: false }
		return dlopenInternal(handle, jsflags);
	},
	_dlopen_js__deps: ['$dlopenInternal'],
	_dlopen_js__async: false
};

mergeInto(LibraryManager.library, LibraryForCustomDynamicLinking);
