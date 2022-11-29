// packages/php-wasm-browser/src/worker-thread/index.js
import { startPHP, PHPBrowser, PHPServer } from "php-wasm";

// packages/php-wasm-browser/src/messaging.js
var DEFAULT_REPLY_TIMEOUT = 25e3;
var lastMessageId = 0;
function postMessageExpectReply(messageTarget, message, ...postMessageArgs) {
  const messageId = ++lastMessageId;
  messageTarget.postMessage(
    {
      ...message,
      messageId
    },
    ...postMessageArgs
  );
  return messageId;
}
async function awaitReply(messageTarget, messageId, timeout = DEFAULT_REPLY_TIMEOUT) {
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
}
function responseTo(messageId, result) {
  return {
    type: "response",
    messageId,
    result
  };
}
function messageHandler(handler) {
  return async function(event, respond) {
    const result = await handler(event.data);
    if (event.data.messageId) {
      respond(responseTo(event.data.messageId, result));
    }
  };
}
function postMessageHandler(handler) {
  return async function(event) {
    const result = await handler(event.data);
    if (event.data.messageId) {
      window.parent.postMessage(
        responseTo(event.data.messageId, result),
        event.origin
      );
    }
  };
}

// packages/php-wasm-browser/src/urls.js
var DEFAULT_BASE_URL = "http://example.com";
function getPathQueryFragment(url) {
  return url.toString().substring(url.origin.length);
}
function isURLScoped(url) {
  return url.pathname.startsWith(`/scope:`);
}
function getURLScope(url) {
  if (isURLScoped(url)) {
    return url.pathname.split("/")[1].split(":")[1];
  }
  return null;
}
function setURLScope(url, scope) {
  if (!scope) {
    return url;
  }
  const newUrl = new URL(url);
  if (isURLScoped(newUrl)) {
    const parts = newUrl.pathname.split("/");
    parts[1] = `scope:${scope}`;
    newUrl.pathname = parts.join("/");
  } else {
    const suffix = newUrl.pathname === "/" ? "" : newUrl.pathname;
    newUrl.pathname = `/scope:${scope}${suffix}`;
  }
  return newUrl;
}
function removeURLScope(url) {
  if (!isURLScoped(url)) {
    return url;
  }
  const newUrl = new URL(url);
  const parts = newUrl.pathname.split("/");
  newUrl.pathname = "/" + parts.slice(2).join("/");
  return newUrl;
}

// packages/php-wasm-browser/src/worker-thread/environment.js
var webEnvironment = {
  name: "WEB",
  setMessageListener(handler) {
    window.addEventListener(
      "message",
      (event) => handler(
        event,
        (response) => event.source.postMessage(response, "*")
      ),
      false
    );
  },
  postMessageToParent(message) {
    window.parent.postMessage(message, "*");
  }
};
var webWorkerEnvironment = {
  name: "WORKER",
  setMessageListener(handler) {
    onmessage = (event) => {
      handler(event, postMessage);
    };
  },
  postMessageToParent(message) {
    postMessage(message);
  }
};
var currentEnvironment = function() {
  if (typeof window !== "undefined") {
    return webEnvironment;
  } else if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    return webWorkerEnvironment;
  } else {
    throw new Error(`Unsupported environment`);
  }
}();
var environment_default = currentEnvironment;

// packages/php-wasm-browser/src/download-monitor.js
var FALLBACK_FILE_SIZE = 5 * 1024 * 1024;
var DownloadMonitor = class extends EventTarget {
  constructor(assetsSizes) {
    super();
    this.assetsSizes = assetsSizes;
    this.monitorWebAssemblyStreaming();
    this.phpArgs = {
      dataFileDownloads: this._createDataFileDownloadsProxy()
    };
  }
  _createDataFileDownloadsProxy() {
    const self2 = this;
    const dataFileDownloads = {};
    return new Proxy(dataFileDownloads, {
      set(obj, file, progress) {
        self2._notify(file, progress.loaded, progress.total);
        obj[file] = new Proxy(JSON.parse(JSON.stringify(progress)), {
          set(nestedObj, prop, value) {
            nestedObj[prop] = value;
            self2._notify(file, nestedObj.loaded, nestedObj.total);
            return true;
          }
        });
        return true;
      }
    });
  }
  monitorWebAssemblyStreaming() {
    const self2 = this;
    const _instantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = (response, ...args) => {
      const file = response.url.substring(
        new URL(response.url).origin.length + 1
      );
      const reportingResponse = cloneResponseMonitorProgress(
        response,
        ({ loaded, total }) => self2._notify(file, loaded, total)
      );
      return _instantiateStreaming(reportingResponse, ...args);
    };
  }
  _notify(file, loaded, total) {
    if (!total) {
      const filename = new URL(file, DEFAULT_BASE_URL).pathname.split("/").pop();
      total = this.assetsSizes[filename];
    }
    this.dispatchEvent(
      new CustomEvent("progress", {
        detail: {
          file,
          loaded,
          total: total || Math.min(loaded, FALLBACK_FILE_SIZE),
          fallbackUsed: !total
        }
      })
    );
  }
};
function cloneResponseMonitorProgress(response, onProgress) {
  const contentLength = response.headers.get("content-length");
  let total = parseInt(contentLength, 10) || FALLBACK_FILE_SIZE;
  return new Response(
    new ReadableStream(
      {
        async start(controller) {
          const reader = response.body.getReader();
          let loaded = 0;
          for (; ; ) {
            try {
              const { done, value } = await reader.read();
              if (value) {
                loaded += value.byteLength;
              }
              if (done) {
                onProgress({ loaded, total: loaded, done });
                controller.close();
                break;
              } else {
                onProgress({ loaded, total, done });
                controller.enqueue(value);
              }
            } catch (e) {
              console.error({ e });
              controller.error(e);
              break;
            }
          }
        }
      }
    ),
    {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    }
  );
}

// packages/php-wasm-browser/src/worker-thread/index.js
async function initializeWorkerThread(bootBrowser = defaultBootBrowser) {
  environment_default.setMessageListener(
    messageHandler(handleMessage)
  );
  let phpBrowser;
  async function handleMessage(message) {
    if (message.type === "initialize_php") {
      phpBrowser = await bootBrowser({
        absoluteUrl: message.absoluteUrl
      });
    } else if (message.type === "is_alive") {
      return true;
    } else if (message.type === "run_php") {
      return await phpBrowser.server.php.run(message.code);
    } else if (message.type === "request") {
      const parsedUrl = new URL(
        message.request.path,
        DEFAULT_BASE_URL
      );
      return await phpBrowser.request({
        ...message.request,
        path: parsedUrl.pathname,
        _GET: parsedUrl.search
      });
    } else {
      console.warn(
        `[WASM Worker] "${message.type}" event received but it has no handler.`
      );
    }
  }
}
async function defaultBootBrowser({ absoluteUrl }) {
  return new PHPBrowser(
    new PHPServer(
      await PHP.create("/php.js", phpArgs),
      {
        absoluteUrl: absoluteUrl || location.origin
      }
    )
  );
}
async function loadPHPWithProgress(phpLoaderModule, dataDependenciesModules = [], phpArgs2 = {}) {
  const modules = [phpLoaderModule, ...dataDependenciesModules];
  const assetsSizes = modules.reduce((acc, module) => {
    acc[module.dependencyFilename] = module.dependenciesTotalSize;
    return acc;
  }, {});
  const downloadMonitor = new DownloadMonitor(assetsSizes);
  downloadMonitor.addEventListener(
    "progress",
    (e) => environment_default.postMessageToParent({
      type: "download_progress",
      ...e.detail
    })
  );
  return await startPHP(
    phpLoaderModule,
    environment_default.name,
    {
      ...phpArgs2,
      ...downloadMonitor.phpArgs
    },
    dataDependenciesModules
  );
}

// packages/php-wasm-browser/src/worker-thread-api.js
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var noop = () => {
};
async function startPHPWorkerThread({
  backend,
  absoluteUrl,
  scope,
  onDownloadProgress = noop
}) {
  while (true) {
    try {
      await backend.sendMessage({ type: "is_alive" }, 50);
      break;
    } catch (e) {
    }
    await sleep(50);
  }
  if (scope) {
    absoluteUrl = setURLScope(new URL(absoluteUrl), scope).toString();
  }
  backend.addMessageListener((e) => {
    if (e.data.type === "download_progress") {
      onDownloadProgress(e.data);
    }
  });
  await backend.sendMessage({
    type: "initialize_php",
    absoluteUrl
  });
  return {
    pathToInternalUrl(path) {
      return `${absoluteUrl}${path}`;
    },
    internalUrlToPath(internalUrl) {
      return getPathQueryFragment(removeURLScope(new URL(internalUrl)));
    },
    async eval(code) {
      return await backend.sendMessage({
        type: "run_php",
        code
      });
    },
    async HTTPRequest(request) {
      return await backend.sendMessage({
        type: "request",
        request
      });
    }
  };
}
function getWorkerThreadBackend(key, url) {
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
    async sendMessage(message, timeout) {
      const messageId = postMessageExpectReply(worker, message);
      const response = await awaitReply(worker, messageId, timeout);
      return response;
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
    async sendMessage(message, timeout) {
      const messageId = postMessageExpectReply(worker.port, message);
      const response = await awaitReply(worker.port, messageId, timeout);
      return response;
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
    async sendMessage(message, timeout) {
      const messageId = postMessageExpectReply(
        iframe.contentWindow,
        message,
        "*"
      );
      const response = await awaitReply(window, messageId, timeout);
      return response;
    },
    addMessageListener(listener) {
      window.addEventListener(
        "message",
        (e) => {
          if (e.source === iframe.contentWindow) {
            listener(e);
          }
        },
        false
      );
    }
  };
}

// packages/php-wasm-browser/src/service-worker.js
async function registerServiceWorker({ broadcastChannel, url, onRequest, scope }) {
  if (!broadcastChannel) {
    throw new Error("Missing the required `broadcastChannel` option.");
  }
  if (!navigator.serviceWorker) {
    throw new Error("Service workers are not supported in this browser.");
  }
  const registration = await navigator.serviceWorker.register(url);
  await registration.update();
  broadcastChannel.addEventListener(
    "message",
    async function onMessage(event) {
      if (scope && event.data.scope !== scope) {
        return;
      }
      console.debug(
        `[Main] "${event.data.type}" message received from a service worker`
      );
      let result;
      if (event.data.type === "request") {
        result = await onRequest(event.data.request);
      } else {
        throw new Error(
          `[Main] Unexpected message received from the service-worker: "${event.data.type}"`
        );
      }
      if (event.data.messageId) {
        broadcastChannel.postMessage(
          responseTo(event.data.messageId, result)
        );
      }
      console.debug(`[Main] "${event.data.type}" message processed`, {
        result
      });
    }
  );
  navigator.serviceWorker.startMessages();
}
function initializeServiceWorker({
  broadcastChannel,
  shouldForwardRequestToPHPServer = (request, unscopedUrl) => seemsLikeAPHPServerPath(unscopedUrl.pathname)
}) {
  if (!broadcastChannel) {
    throw new Error("Missing the required `broadcastChannel` option.");
  }
  self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim());
  });
  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    const unscopedUrl = removeURLScope(url);
    if (!shouldForwardRequestToPHPServer(event.request, unscopedUrl)) {
      if (isURLScoped(url)) {
        event.preventDefault();
        return event.respondWith(
          new Promise(async (accept) => {
            const newRequest = await cloneRequest(event.request, {
              url: unscopedUrl
            });
            accept(fetch(newRequest));
          })
        );
      }
      return;
    }
    event.preventDefault();
    return event.respondWith(
      new Promise(async (accept) => {
        console.log(
          `[ServiceWorker] Serving request: ${getPathQueryFragment(
            removeURLScope(url)
          )}`
        );
        const { post, files } = await parsePost(event.request);
        const requestHeaders = {};
        for (const pair of event.request.headers.entries()) {
          requestHeaders[pair[0]] = pair[1];
        }
        const requestedPath = getPathQueryFragment(url);
        let phpResponse;
        try {
          const message = {
            type: "request",
            scope: getURLScope(url),
            request: {
              path: requestedPath,
              method: event.request.method,
              files,
              _POST: post,
              headers: requestHeaders
            }
          };
          console.log(
            "[ServiceWorker] Forwarding a request to the main app",
            {
              message
            }
          );
          const messageId = postMessageExpectReply(
            broadcastChannel,
            message
          );
          phpResponse = await awaitReply(broadcastChannel, messageId);
          console.log(
            "[ServiceWorker] Response received from the main app",
            {
              phpResponse
            }
          );
        } catch (e) {
          console.error(e, { requestedPath });
          throw e;
        }
        accept(
          new Response(phpResponse.body, {
            headers: phpResponse.headers,
            status: phpResponse.statusCode
          })
        );
      })
    );
  });
}
function seemsLikeAPHPServerPath(path) {
  return seemsLikeAPHPFile(path) || seemsLikeADirectoryRoot(path);
}
function seemsLikeAPHPFile(path) {
  return path.endsWith(".php") || path.includes(".php/");
}
function seemsLikeADirectoryRoot(path) {
  const lastSegment = path.split("/").pop();
  return !lastSegment.includes(".");
}
async function parsePost(request) {
  if (request.method !== "POST") {
    return { post: void 0, files: void 0 };
  }
  try {
    const formData = await request.clone().formData();
    const post = {};
    const files = {};
    for (const key of formData.keys()) {
      const value = formData.get(key);
      if (value instanceof File) {
        files[key] = value;
      } else {
        post[key] = value;
      }
    }
    return { post, files };
  } catch (e) {
  }
  return { post: await request.clone().json(), files: {} };
}
async function cloneRequest(request, overrides) {
  const body = ["GET", "HEAD"].includes(request.method) || "body" in overrides ? void 0 : await request.blob();
  return new Request(overrides.url || request.url, {
    body,
    method: request.method,
    headers: request.headers,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    mode: request.mode === "navigate" ? "same-origin" : request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    integrity: request.integrity,
    ...overrides
  });
}
export {
  awaitReply,
  cloneResponseMonitorProgress,
  environment_default as environment,
  getWorkerThreadBackend,
  initializeServiceWorker,
  initializeWorkerThread,
  loadPHPWithProgress,
  messageHandler,
  postMessageExpectReply,
  postMessageHandler,
  registerServiceWorker,
  responseTo,
  seemsLikeAPHPServerPath,
  startPHPWorkerThread
};
