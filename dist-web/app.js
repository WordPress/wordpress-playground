(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/shared/messaging.mjs
  var DEFAULT_REPLY_TIMEOUT = 25e3;
  var lastMessageId = 0;
  function postMessageExpectReply(messageTarget, message, ...postMessageArgs) {
    const messageId = ++lastMessageId;
    messageTarget.postMessage(
      __spreadProps(__spreadValues({}, message), {
        messageId
      }),
      ...postMessageArgs
    );
    return messageId;
  }
  function awaitReply(_0, _1) {
    return __async(this, arguments, function* (messageTarget, messageId, timeout = DEFAULT_REPLY_TIMEOUT) {
      return new Promise((resolve, reject) => {
        const responseHandler = (event) => {
          if (event.data.type === "response" && event.data.messageId === messageId) {
            messageTarget.removeEventListener("message", responseHandler);
            clearTimeout(failOntimeout);
            resolve(event.data.result);
          }
        };
        const failOntimeout = setTimeout(() => {
          reject(new Error("Request timed out"));
          messageTarget.removeEventListener("message", responseHandler);
        }, timeout);
        messageTarget.addEventListener("message", responseHandler);
      });
    });
  }
  function responseTo(messageId, result) {
    return {
      type: "response",
      messageId,
      result
    };
  }

  // src/web/library.js
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  var noop = () => {
  };
  function runWordPress(_0) {
    return __async(this, arguments, function* ({
      wasmWorkerBackend: wasmWorkerBackend2,
      wasmWorkerUrl: wasmWorkerUrl2,
      wordPressSiteUrl: wordPressSiteUrl2,
      serviceWorkerUrl: serviceWorkerUrl2,
      assignScope = true,
      onWasmDownloadProgress
    }) {
      const scope = assignScope ? Math.random().toFixed(16) : void 0;
      const wasmWorker = yield createWordPressWorker({
        backend: getWorkerBackend(wasmWorkerBackend2, wasmWorkerUrl2),
        wordPressSiteUrl: wordPressSiteUrl2,
        scope,
        onDownloadProgress: onWasmDownloadProgress
      });
      yield registerServiceWorker({
        url: serviceWorkerUrl2,
        onRequest: (request) => __async(this, null, function* () {
          return yield wasmWorker.HTTPRequest(request);
        }),
        scope
      });
      return wasmWorker;
    });
  }
  function registerServiceWorker(_0) {
    return __async(this, arguments, function* ({ url, onRequest, scope }) {
      if (!navigator.serviceWorker) {
        alert("Service workers are not supported in this browser.");
        throw new Error("Service workers are not supported in this browser.");
      }
      yield navigator.serviceWorker.register(url);
      const serviceWorkerChannel = new BroadcastChannel(
        `wordpress-service-worker`
      );
      serviceWorkerChannel.addEventListener(
        "message",
        function onMessage(event) {
          return __async(this, null, function* () {
            if (scope && event.data.scope !== scope) {
              return;
            }
            console.debug(
              `[Main] "${event.data.type}" message received from a service worker`
            );
            let result;
            if (event.data.type === "request" || event.data.type === "httpRequest") {
              result = yield onRequest(event.data.request);
            } else {
              throw new Error(
                `[Main] Unexpected message received from the service-worker: "${event.data.type}"`
              );
            }
            if (event.data.messageId) {
              serviceWorkerChannel.postMessage(
                responseTo(event.data.messageId, result)
              );
            }
            console.debug(`[Main] "${event.data.type}" message processed`, {
              result
            });
          });
        }
      );
      navigator.serviceWorker.startMessages();
      yield sleep(0);
      const wordPressDomain = new URL(url).origin;
      const wordPressBaseUrl = scope ? `${wordPressDomain}/scope:${scope}` : wordPressDomain;
      const response = yield fetch(`${wordPressBaseUrl}/wp-admin/atomlib.php`);
      if (!response.ok) {
        window.location.reload();
      }
    });
  }
  function createWordPressWorker(_0) {
    return __async(this, arguments, function* ({
      backend,
      wordPressSiteUrl: wordPressSiteUrl2,
      scope,
      onDownloadProgress = noop
    }) {
      while (true) {
        try {
          yield backend.sendMessage({ type: "is_alive" }, 50);
          break;
        } catch (e) {
        }
        yield sleep(50);
      }
      const scopePath = scope ? `/scope:${scope}` : "";
      if (scope) {
        wordPressSiteUrl2 += scopePath;
      }
      backend.addMessageListener((e) => {
        if (e.data.type === "download_progress") {
          onDownloadProgress(e.data);
        }
      });
      yield backend.sendMessage({
        type: "initialize_wordpress",
        siteURL: wordPressSiteUrl2
      });
      return {
        pathToInternalUrl(wordPressPath) {
          return `${wordPressSiteUrl2}${wordPressPath}`;
        },
        internalUrlToPath(internalUrl) {
          const url = new URL(internalUrl);
          return url.toString().substr(url.origin.length).substr(scopePath.length);
        },
        HTTPRequest(request) {
          return __async(this, null, function* () {
            return yield backend.sendMessage({
              type: "request",
              request
            });
          });
        }
      };
    });
  }
  function getWorkerBackend(key, url) {
    const backends = {
      webworker: webWorkerBackend,
      shared_worker: sharedWorkerBackend,
      iframe: iframeBackend
    };
    const backend = backends[key];
    if (!backend) {
      const availableKeys = Object.keys(backends).join(", ");
      throw new Error(
        `Unknown worker backend: "${key}". Choices: ${availableKeys}`
      );
    }
    return backend(url);
  }
  function webWorkerBackend(workerURL) {
    const worker = new Worker(workerURL);
    return {
      sendMessage(_0) {
        return __async(this, arguments, function* (message, timeout = DEFAULT_REPLY_TIMEOUT) {
          const messageId = postMessageExpectReply(worker, message);
          const response = yield awaitReply(worker, messageId, timeout);
          return response;
        });
      },
      addMessageListener(listener) {
        worker.onmessage = listener;
      }
    };
  }
  function sharedWorkerBackend(workerURL) {
    const worker = new SharedWorker(workerURL);
    worker.port.start();
    return {
      sendMessage(_0) {
        return __async(this, arguments, function* (message, timeout = DEFAULT_REPLY_TIMEOUT) {
          const messageId = postMessageExpectReply(worker.port, message);
          const response = yield awaitReply(worker.port, messageId, timeout);
          return response;
        });
      },
      addMessageListener(listener) {
        worker.port.onmessage = listener;
      }
    };
  }
  function iframeBackend(workerDocumentURL) {
    const iframe = document.createElement("iframe");
    iframe.src = workerDocumentURL;
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    return {
      sendMessage(_0) {
        return __async(this, arguments, function* (message, timeout = DEFAULT_REPLY_TIMEOUT) {
          const messageId = postMessageExpectReply(
            iframe.contentWindow,
            message,
            "*"
          );
          const response = yield awaitReply(window, messageId, timeout);
          return response;
        });
      },
      addMessageListener(listener) {
        window.addEventListener("message", (e) => {
          if (e.source === iframe.contentWindow) {
            listener(e);
          }
        }, false);
      }
    };
  }

  // src/web/config.js
  var serviceWorkerUrl = "https://wasm.wordpress.net/service-worker.js";
  var serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
  var wordPressSiteUrl = serviceWorkerOrigin;
  var wasmWorkerUrl = "https://wasm-worker.wordpress.net/iframe-worker.html";
  var wasmWorkerBackend = "iframe";

  // src/web/app.mjs
  window.startWordPress = function() {
    return __async(this, arguments, function* (options = {}) {
      console.log("[Main] Starting WordPress...");
      const wasmWorker = yield runWordPress({
        wasmWorkerBackend,
        wasmWorkerUrl,
        wordPressSiteUrl,
        serviceWorkerUrl,
        assignScope: true,
        onWasmDownloadProgress: options.onWasmDownloadProgress
      });
      console.log("[Main] WordPress is running");
      return wasmWorker;
    });
  };
})();
