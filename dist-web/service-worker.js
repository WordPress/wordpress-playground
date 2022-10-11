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

  // src/web/service-worker.js
  var broadcastChannel = new BroadcastChannel("wordpress-service-worker");
  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    const isWpOrgRequest = url.hostname.includes("api.wordpress.org");
    const isPHPRequest = url.pathname.endsWith("/") && url.pathname !== "/" || url.pathname.endsWith(".php");
    if (isWpOrgRequest || !isPHPRequest) {
      console.log(`[ServiceWorker] Ignoring request: ${url.pathname}`);
      return;
    }
    event.preventDefault();
    return event.respondWith(
      new Promise(async (accept) => {
        console.log(`[ServiceWorker] Serving request: ${url.pathname}?${url.search}`);
        console.log({ isWpOrgRequest, isPHPRequest });
        const post = await parsePost(event.request);
        const requestHeaders = {};
        for (const pair of event.request.headers.entries()) {
          requestHeaders[pair[0]] = pair[1];
        }
        let wpResponse;
        try {
          const message = {
            type: "httpRequest",
            request: {
              path: url.pathname + url.search,
              method: event.request.method,
              _POST: post,
              headers: requestHeaders
            }
          };
          console.log("[ServiceWorker] Forwarding a request to the main app", { message });
          const messageId = postMessageExpectReply(broadcastChannel, message);
          wpResponse = await awaitReply(broadcastChannel, messageId);
          console.log("[ServiceWorker] Response received from the main app", { wpResponse });
        } catch (e) {
          console.error(e);
          throw e;
        }
        accept(new Response(
          wpResponse.body,
          {
            headers: wpResponse.headers
          }
        ));
      })
    );
  });
  async function parsePost(request) {
    if (request.method !== "POST") {
      return void 0;
    }
    try {
      const formData = await request.clone().formData();
      const post = {};
      for (const key of formData.keys()) {
        post[key] = formData.get(key);
      }
      return post;
    } catch (e) {
    }
    return await request.clone().json();
  }
})();
