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
if (PHPLoader.debug) {
    const originalHandleSleep = Asyncify.handleSleep;
    Asyncify.handleSleep = function (startAsync) {
        if (!ABORT) {
            Module["lastAsyncifyStackSource"] = new Error();
        }
        return originalHandleSleep(startAsync);
    }
}

/**
 * Expose a way to shut down the PHP runtime
 */
Module["exitRuntime"] = function () {
    exitRuntime();

    Module["HEAP8"].buffer = null;
    Module["HEAP16"].buffer = null;
    Module["HEAP32"].buffer = null;
    Module["HEAPU8"].buffer = null;
    Module["HEAPU16"].buffer = null;
    Module["HEAPU32"].buffer = null;
    Module["HEAPF32"].buffer = null;
    Module["HEAPF64"].buffer = null;

    HEAP16 = null;
    HEAP32 = null;
    HEAPU8 = null;
    HEAPU16 = null;
    HEAPU32 = null;
    HEAPF32 = null;
    HEAPF64 = null;
    
    updateGlobalBufferAndViews(Buffer.from([]));

    wasmMemory.buffer = null;
    wasmTable = null;
    wasmMemory = null;
    wasmBinary = null;
    for (let key in Module["asm"]) {
        Module["asm"][key] = null
    }
    for (let key in Module) {
        Module[key] = null
    }
    Module = null;
}
