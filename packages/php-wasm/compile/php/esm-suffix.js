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

// TODO: Revisit this hack after discussion with the Emscripten team.
if (typeof NODEFS === 'object') {
    // TODO: Remove tracing or disconnect before merge
    const traceOptionDefaults = {
        shouldTrace(...args) { return true; },
        formatArgs(...args) {
            return args.join(', ');
        },
        formatResult(r) { return r; },
    }
    function wrapForTrace(
        fn,
        fnName,
        traceOptions,
    ) {
        traceOptions = { ...traceOptionDefaults, ...traceOptions };

        return function traceFn(...args) {
            const shouldTrace = traceOptions.shouldTrace(...args);
            if (shouldTrace) {
                js_wasm_trace(`call   ${fnName} ${traceOptions.formatArgs(...args)}`);
            }
            let error;
            let result;
            try {
                result = fn(...args);
                return result;
            } catch (e) {
                error = e;
                throw e;
            } finally {
                if (shouldTrace) {
                    if (error) {
                        js_wasm_trace(`error  ${fnName} ${traceOptions.formatArgs(...args)} -> 💥 ${JSON.stringify(error)}`);
                    } else {
                        let formattedResult = traceOptions.formatResult(result);
                        js_wasm_trace(`return ${fnName} ${traceOptions.formatArgs(...args)} ${formattedResult ? `-> ${formattedResult}` : ''}`);
                    }
                }
            }
        };
    }

    // TODO: Clean up or remove before merge?
    function addMethodTrace(obj, fnName, traceOptions) {
        obj[fnName] = wrapForTrace(obj[fnName], fnName, traceOptions);
    }

    function formatStream(stream) {
        var path = NODEFS.realPath(stream.node);
        return `${stream.nfd}, ${path}`;
    }
    function shouldTraceStreamOp(stream) {
        const path = NODEFS.realPath(stream.node);
        return path.includes('.ht.sqlite');
    }

    addMethodTrace(NODEFS.node_ops, 'unlink', {
        shouldTrace: (_, path) => path.includes('.ht.sqlite'),
        formatArgs: (_, path) => path,
    });
    addMethodTrace(NODEFS.stream_ops, 'open', {
        shouldTrace: shouldTraceStreamOp,
        formatArgs: (stream) => formatStream(stream),
    });
    addMethodTrace(NODEFS.stream_ops, 'close', {
        shouldTrace: shouldTraceStreamOp,
        formatArgs: (stream) => formatStream(stream),
    });

    var originalHashAddNode = FS.hashAddNode;
    FS.hashAddNode = function hashAddNodeIfNotNODEFS(node) {
        if (node.node_ops === NODEFS.node_ops) {
            // Avoid caching NODEFS VFS nodes so multiple instances
            // can access the same underlying filesystem without
            // conflicting caches.
            return;
        }
        return originalHashAddNode.apply(FS, arguments);
    };
    const originalCreateNode = NODEFS.createNode;
    NODEFS.createNode = function createNodeWithSharedFlag() {
        const node = originalCreateNode.apply(NODEFS, arguments);
        // TODO: Better name?
        // TODO: Is this a reasonable solution to marking underlying target of PROXYFS?
        node.isSharedFS = true;
        return node;
    };
}

return PHPLoader;

// Close the opening bracket from esm-prefix.js:
}
