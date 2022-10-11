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

  // src/web/app.mjs
  if (!navigator.serviceWorker) {
    alert("Service workers are not supported by your browser");
  }
  var serviceWorkerReady = navigator.serviceWorker.register(`/service-worker.js`);
  var serviceWorkerChannel = new BroadcastChannel("wordpress-service-worker");
  serviceWorkerChannel.addEventListener("message", async function onMessage(event) {
    console.debug(`[Main] "${event.data.type}" message received from a service worker`);
    let result;
    if (event.data.type === "is_ready") {
      result = isReady;
    } else if (event.data.type === "request" || event.data.type === "httpRequest") {
      const worker = await wasmWorker;
      result = await worker.HTTPRequest(event.data.request);
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
  var wasmWorker = createWordPressWorker(
    {
      backend: webWorkerBackend("/wasm-worker.js"),
      wordPressSiteURL: location.href
    }
  );
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
  var isReady = false;
  async function init() {
    console.log("[Main] Initializing the worker");
    await wasmWorker;
    await serviceWorkerReady;
    isReady = true;
    console.log("[Main] Iframe is ready");
    const WPIframe = document.querySelector("#wp");
    WPIframe.src = "/wp-login.php";
  }
  init();
})();
