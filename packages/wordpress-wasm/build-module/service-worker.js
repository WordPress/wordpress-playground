// packages/wordpress-wasm/src/service-worker.js
import { initializeServiceWorker, seemsLikeAPHPServerPath } from "php-wasm-browser";

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

// packages/wordpress-wasm/src/index.js
var isUploadedFilePath = (path) => {
  return path.startsWith("/wp-content/uploads/") || path.startsWith("/wp-content/plugins/") || path.startsWith("/wp-content/themes/") && !path.startsWith("/wp-content/themes/twentytwentytwo/");
};

// packages/wordpress-wasm/src/service-worker.js
initializeServiceWorker({
  broadcastChannel: new BroadcastChannel("wordpress-wasm"),
  shouldForwardRequestToPHPServer
});
function shouldForwardRequestToPHPServer(request, unscopedUrl) {
  const path = unscopedUrl.pathname;
  return !path.startsWith("/plugin-proxy") && (seemsLikeAPHPServerPath(path) || isUploadedFilePath(path));
}
