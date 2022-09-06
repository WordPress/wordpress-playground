(() => {
  // src/web/service-worker.js
  var workerChannel = new BroadcastChannel("wordpress-service-worker");
  var lastRequestId = 0;
  function postWebWorkerMessage(data, timeout = 5e4) {
    return new Promise((resolve, reject) => {
      const requestId = ++lastRequestId;
      const responseHandler = (event) => {
        if (event.data.type === "response" && event.data.requestId === requestId) {
          workerChannel.removeEventListener("message", responseHandler);
          clearTimeout(failOntimeout);
          resolve(event.data.result);
        }
      };
      const failOntimeout = setTimeout(() => {
        reject("Request timed out");
        workerChannel.removeEventListener("message", responseHandler);
      }, timeout);
      workerChannel.addEventListener("message", responseHandler);
      workerChannel.postMessage({
        ...data,
        requestId
      });
    });
  }
  self.addEventListener("fetch", (event) => {
    event.preventDefault();
    return event.respondWith(
      new Promise(async (accept) => {
        const post = await parsePost(event.request);
        const url = new URL(event.request.url);
        const isInternalRequest = url.pathname.endsWith("/") || url.pathname.endsWith(".php");
        if (!isInternalRequest) {
          console.log(`[ServiceWorker] Ignoring request: ${url.pathname}`);
          accept(fetch(event.request));
          return;
        }
        const requestHeaders = {};
        for (const pair of event.request.headers.entries()) {
          requestHeaders[pair[0]] = pair[1];
        }
        console.log(`[ServiceWorker] Serving request: ${url.pathname}?${url.search}`);
        let wpResponse;
        try {
          wpResponse = await postWebWorkerMessage({
            type: "httpRequest",
            request: {
              path: url.pathname + url.search,
              method: event.request.method,
              _POST: post,
              headers: requestHeaders
            }
          });
          console.log({ wpResponse });
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
