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

if (typeof NODEFS === 'object') {
    // We override NODEFS.createNode() to add an `isSharedFS` flag to all NODEFS
    // nodes. This way we can tell whether file-locking is needed and possible
    // for an FS node, even if wrapped with PROXYFS.
    const originalNodeFsCreateNode = NODEFS.createNode;
    NODEFS.createNode = function createNodeWithSharedFlag() {
        const node = originalNodeFsCreateNode.apply(NODEFS, arguments);
        node.isSharedFS = true;
        return node;
    };

    var originalHashAddNode = FS.hashAddNode;
    FS.hashAddNode = function hashAddNodeIfNotSharedFS(node) {
        if (node?.isSharedFS) {
            // Avoid caching shared VFS nodes so multiple instances
            // can access the same underlying filesystem without
            // conflicting caches.
            return;
        }
        return originalHashAddNode.apply(FS, arguments);
    };
}

/**
 * Expose the PHP version so the PHP class can make version-specific
 * adjustments to `php.ini`.
 */
PHPLoader['phpVersion'] = (() => {
    const [ major, minor, patch ] = phpVersionString.split('.').map(Number);
    return { major, minor, patch };
})();

return PHPLoader;

// Close the opening bracket from esm-prefix.js:
}
