/**
 * Emscripten resolves `localhost` to a random IP address. Let's
 * make it always resolve to 127.0.0.1.
 */
DNS.address_map.addrs.localhost = '127.0.0.1';

/**
 * Debugging Asyncify errors is tricky because the stack trace is lost when the
 * error is thrown. This code saves the stack trace in a global variable 
 * so that it can be inspected later.
 */
PHPLoader.debug = 'debug' in PHPLoader ? PHPLoader.debug : true;
if (PHPLoader.debug && typeof Asyncify !== "undefined") {
    const originalHandleSleep = Asyncify.handleSleep;
    Asyncify.handleSleep = function (startAsync) {
        if (!ABORT) {
            Module["lastAsyncifyStackSource"] = new Error();
        }
        return originalHandleSleep(startAsync);
    }
}

/**
 * Data dependencies call removeRunDependency() when they are loaded.
 * The synchronous call stack then continues to run. If an error occurs
 * in PHP initialization, e.g. Out Of Memory error, it will not be
 * caught by any try/catch. This override propagates the failure to
 * PHPLoader.onAbort() so that it can be handled.
 */
const originalRemoveRunDependency = PHPLoader['removeRunDependency'];
PHPLoader['removeRunDependency'] = function (...args) {
    try {
        originalRemoveRunDependency(...args);
    } catch (e) {
        PHPLoader['onAbort'](e);
    }
}

/**
 * Other exports live in the Dockerfile in:
 * 
 * * EXPORTED_RUNTIME_METHODS
 * * EXPORTED_FUNCTIONS
 * 
 * These exports, however, live in here because:
 * 
 * * Listing them in EXPORTED_RUNTIME_METHODS doesn't actually
 *   export them. This could be a bug in Emscripten or a consequence of
 *   that option being deprecated.
 * * Listing them in EXPORTED_FUNCTIONS works, but they are overridden
 *   on every `BasePHP.run()` call. This is a problem because we want to
 *   spy on these calls in some unit tests.
 * 
 * Therefore, we export them here.
 */
PHPLoader['malloc'] = _malloc;
PHPLoader['free'] = typeof _free === 'function' ? _free : PHPLoader['_wasm_free'];

return PHPLoader;

// Close the opening bracket from esm-prefix.js:
}
