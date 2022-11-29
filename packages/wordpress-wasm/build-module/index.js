// packages/wordpress-wasm/src/index.js
import {
  postMessageExpectReply,
  awaitReply,
  responseTo,
  registerServiceWorker,
  startPHPWorkerThread,
  getWorkerThreadBackend
} from "php-wasm-browser";

// packages/wordpress-wasm/src/config.js
import { phpJsHash } from "php-wasm";
import { phpJsHash as phpJsHash2 } from "php-wasm";
var serviceWorkerUrl = "http://127.0.0.1:8777/service-worker.js";
var serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
var wordPressSiteUrl = serviceWorkerOrigin;
var wasmWorkerUrl = "http://127.0.0.1:8778/iframe-worker.html?0891786456959600";
var wasmWorkerBackend = "iframe";

// packages/wordpress-wasm/src/index.js
async function bootWordPress({
  assignScope = true,
  onWasmDownloadProgress
}) {
  assertNotInfiniteLoadingLoop();
  const scope = assignScope ? Math.random().toFixed(16) : void 0;
  const workerThread = await startPHPWorkerThread({
    backend: getWorkerThreadBackend(wasmWorkerBackend, wasmWorkerUrl),
    absoluteUrl: wordPressSiteUrl,
    scope,
    onDownloadProgress: onWasmDownloadProgress
  });
  await registerServiceWorker({
    url: serviceWorkerUrl,
    broadcastChannel: new BroadcastChannel("wordpress-wasm"),
    onRequest: async (request) => {
      return await workerThread.HTTPRequest(request);
    },
    scope
  });
  return workerThread;
}
function assertNotInfiniteLoadingLoop() {
  let isBrowserInABrowser = false;
  try {
    isBrowserInABrowser = window.parent !== window && window.parent.IS_WASM_WORDPRESS;
  } catch (e) {
  }
  if (isBrowserInABrowser) {
    throw new Error(
      "The service worker did not load correctly. This is a bug, please report it on https://github.com/WordPress/wordpress-wasm/issues"
    );
  }
  window.IS_WASM_WORDPRESS = true;
}
var isUploadedFilePath = (path) => {
  return path.startsWith("/wp-content/uploads/") || path.startsWith("/wp-content/plugins/") || path.startsWith("/wp-content/themes/") && !path.startsWith("/wp-content/themes/twentytwentytwo/");
};
export {
  bootWordPress,
  isUploadedFilePath
};
