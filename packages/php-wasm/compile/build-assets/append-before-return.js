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
