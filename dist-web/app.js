(() => {
  // src/shared/messaging.mjs
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

  // src/web/library.js
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, 50));
  async function registerServiceWorker(url, onRequest) {
    if (!navigator.serviceWorker) {
      alert("Service workers are not supported in this browser.");
      throw new Exception("Service workers are not supported in this browser.");
    }
    await navigator.serviceWorker.register(url);
    const serviceWorkerChannel = new BroadcastChannel("wordpress-service-worker");
    serviceWorkerChannel.addEventListener("message", async function onMessage(event) {
      console.debug(`[Main] "${event.data.type}" message received from a service worker`);
      let result;
      if (event.data.type === "request" || event.data.type === "httpRequest") {
        result = await onRequest(event.data.request);
      } else {
        throw new Error(`[Main] Unexpected message received from the service-worker: "${event.data.type}"`);
      }
      if (event.data.messageId) {
        serviceWorkerChannel.postMessage(
          responseTo(
            event.data.messageId,
            result
          )
        );
      }
      console.debug(`[Main] "${event.data.type}" message processed`, { result });
    });
    navigator.serviceWorker.startMessages();
    await sleep(0);
    const wordPressDomain = new URL(url).origin;
    const response = await fetch(`${wordPressDomain}/wp-admin/atomlib.php`);
    if (!response.ok) {
      window.location.reload();
    }
  }
  async function createWordPressWorker({ backend, wordPressSiteUrl: wordPressSiteUrl2 }) {
    while (true) {
      try {
        await backend.sendMessage({ type: "is_alive" }, 50);
        break;
      } catch (e) {
      }
      await sleep(50);
    }
    await backend.sendMessage({
      type: "initialize_wordpress",
      siteURL: wordPressSiteUrl2
    });
    return {
      async HTTPRequest(request) {
        return await backend.sendMessage({
          type: "request",
          request
        });
      }
    };
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
      throw new Error(`Unknown worker backend: "${key}". Choices: ${availableKeys}`);
    }
    return backend(url);
  }
  function webWorkerBackend(workerURL) {
    const worker = new Worker(workerURL);
    return {
      sendMessage: async function(message, timeout = DEFAULT_REPLY_TIMEOUT) {
        const messageId = postMessageExpectReply(worker, message);
        const response = await awaitReply(worker, messageId, timeout);
        return response;
      }
    };
  }
  function sharedWorkerBackend(workerURL) {
    const worker = new SharedWorker(workerURL);
    worker.port.start();
    return {
      sendMessage: async function(message, timeout = DEFAULT_REPLY_TIMEOUT) {
        const messageId = postMessageExpectReply(worker.port, message);
        const response = await awaitReply(worker.port, messageId, timeout);
        return response;
      }
    };
  }
  function iframeBackend(workerDocumentURL) {
    const iframe = document.createElement("iframe");
    iframe.src = workerDocumentURL;
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    return {
      sendMessage: async function(message, timeout = DEFAULT_REPLY_TIMEOUT) {
        const messageId = postMessageExpectReply(iframe.contentWindow, message, "*");
        const response = await awaitReply(window, messageId, timeout);
        return response;
      }
    };
  }

  // src/web/config.js
  var serviceWorkerUrl = "http://127.0.0.1:8777/service-worker.js";
  var serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
  var wordPressSiteUrl = serviceWorkerOrigin;
  var wasmWorkerUrl = "http://127.0.0.1:8778/iframe-worker.html";
  var wasmWorkerOrigin = new URL(wasmWorkerUrl).origin;
  var wasmWorkerBackend = "iframe";

  // src/web/app.mjs
  async function init() {
    console.log("[Main] Initializing the workers");
    const wasmWorker = await createWordPressWorker(
      {
        backend: getWorkerBackend(wasmWorkerBackend, wasmWorkerUrl),
        wordPressSiteUrl
      }
    );
    await registerServiceWorker(
      serviceWorkerUrl,
      async (request) => {
        return await wasmWorker.HTTPRequest(request);
      }
    );
    console.log("[Main] Workers are ready");
    document.querySelector("#wp").src = "/wp-login.php";
  }
  init();
})();
