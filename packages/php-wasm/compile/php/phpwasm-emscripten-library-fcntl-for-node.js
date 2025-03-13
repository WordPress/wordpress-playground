/**
 * This file is an Emscripten "library" file. It is included in the
 * build "php-8.0.js" file and implements JavaScript functions that
 * called from C code.
 *
 * @see https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#implement-a-c-api-in-javascript
 */
'use strict';

const LibraryForNode = {
	default__syscall_fcntl64: LibraryManager.library.__syscall_fcntl64,
};

// Carry over decorators used by the built-in implementation
// https://github.com/emscripten-core/emscripten/blob/002962761ca7e370aed80680b61e5237b53510c0/src/utility.mjs#L202-L219
for (const [key, value] of Object.entries(LibraryManager.library)) {
	if (key.startsWith('__syscall_fcntl64__') && isDecorator(key)) {
		LibraryForNode[`default${key}`] = value;
	}
}

autoAddDeps(LibraryForNode, 'default__syscall_fcntl64');
mergeInto(LibraryManager.library, LibraryForNode);
