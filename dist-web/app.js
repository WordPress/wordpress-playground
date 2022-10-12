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
  }
  async function createWordPressWorker({ backend, wordPressSiteURL }) {
    while (true) {
      try {
        await backend.sendMessage({ type: "is_alive" }, 50);
        break;
      } catch (e) {
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await backend.sendMessage({
      type: "initialize_wordpress",
      siteURL: wordPressSiteURL
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

  // src/web/app.mjs
  async function init() {
    console.log("[Main] Initializing the workers");
    const wasmWorker = await createWordPressWorker(
      {
        backend: iframeBackend("http://127.0.0.1:8778/iframe-worker.html"),
        wordPressSiteURL: location.href
      }
    );
    await registerServiceWorker(
      `http://localhost:8777/service-worker.js`,
      async (request) => {
        return await wasmWorker.HTTPRequest(request);
      }
    );
    console.log("[Main] Workers are ready");
    document.querySelector("#wp").src = "/wp-login.php";
  }
  init();
})();
