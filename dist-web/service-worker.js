(() => {
  // src/shared/messaging.mjs
  function postMessageFactory(target) {
    let lastRequestId = 0;
    return function postMessage(data, timeout = 5e4) {
      return new Promise((resolve, reject) => {
        const requestId = ++lastRequestId;
        const responseHandler = (event) => {
          if (event.data.type === "response" && event.data.requestId === requestId) {
            target.removeEventListener("message", responseHandler);
            clearTimeout(failOntimeout);
            resolve(event.data.result);
          }
        };
        const failOntimeout = setTimeout(() => {
          reject("Request timed out");
          target.removeEventListener("message", responseHandler);
        }, timeout);
        target.addEventListener("message", responseHandler);
        target.postMessage({
          ...data,
          requestId
        });
      });
    };
  }

  // src/web/service-worker.js
  var workerChannel = new BroadcastChannel("wordpress-service-worker");
  var postWebWorkerMessage = postMessageFactory(workerChannel);
  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    const isWpOrgRequest = url.hostname.includes("api.wordpress.org");
    const isPHPRequest = url.pathname.endsWith("/") || url.pathname.endsWith(".php");
    if (isWpOrgRequest || !isPHPRequest) {
      console.log(`[ServiceWorker] Ignoring request: ${url.pathname}`);
      return;
    }
    event.preventDefault();
    return event.respondWith(
      new Promise(async (accept) => {
        console.log(`[ServiceWorker] Serving request: ${url.pathname}?${url.search}`);
        const post = await parsePost(event.request);
        const requestHeaders = {};
        for (const pair of event.request.headers.entries()) {
          requestHeaders[pair[0]] = pair[1];
        }
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
