/**
 * Override Emscripten's _emscripten_lookup_name to resolve hostnames with
 * Node.js DNS when running in the Node environment.
 *
 * JSPI vs Asyncify
 * ----------------
 * In JSPI builds (ASYNCIFY == 2) we can await the async dns.lookup() Promise.
 * In classic Asyncify builds (ASYNCIFY == 1) we block the calling thread with
 * Atomics.wait on a SharedArrayBuffer to synchronise the async callback into a
 * synchronous return value without rewinding the stack.
 */
'use strict';

const LibraryForNodeDnsLookup = {
	// $-prefixed deps pull the runtime helpers into scope.
	__emscripten_lookup_name__deps: ['$DNS', '$inetPton4', '$UTF8ToString'],
	__emscripten_lookup_name__sig: 'ip',
	// Ensure our implementation is used even if the core library defines one.
	__emscripten_lookup_name__postset:
		'const original__emscripten_lookup_name = __emscripten_lookup_name; if (typeof __emscripten_lookup_name !== "undefined") { __emscripten_lookup_name = ___emscripten_lookup_name; }'
#if ASYNCIFY == 2
		+ '___emscripten_lookup_name.isAsync = true;'
#endif
    ,
	__emscripten_lookup_name: function __emscripten_lookup_name(namePtr) {
#if ASYNCIFY == 2
		return Asyncify.handleAsync(async () => {
#endif
			if ( ! ENVIRONMENT_IS_NODE ) {
				return original__emscripten_lookup_name(namePtr);
			}
			if ( ! PHPLoader.syscalls ) {
				return original__emscripten_lookup_name(namePtr);
			}

			const hostname = UTF8ToString(namePtr);

			let ipString = '';
			try {
				ipString = (
#if ASYNCIFY == 2
					await Promise.resolve(
#endif
						PHPLoader.syscalls.gethostbyname(hostname)
#if ASYNCIFY == 2
					)
#endif
				);
			} catch (e) {
				// Fall through to the default synthetic mapping if native DNS fails.
			}

			return inetPton4(ipString);
#if ASYNCIFY == 2
		});
#endif
	},
};

mergeInto(LibraryManager.library, LibraryForNodeDnsLookup);
