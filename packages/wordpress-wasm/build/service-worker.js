// packages/wordpress-wasm/src/service-worker.js
var import_php_wasm_browser2 = require("php-wasm-browser");

// packages/wordpress-wasm/src/index.js
var import_php_wasm_browser = require("php-wasm-browser");

// packages/wordpress-wasm/src/config.js
var import_php_wasm = require("php-wasm");
var import_php_wasm2 = require("php-wasm");
var serviceWorkerUrl = "http://127.0.0.1:8777/service-worker.js";
var serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;

// packages/wordpress-wasm/src/index.js
var isUploadedFilePath = (path) => {
  return path.startsWith("/wp-content/uploads/") || path.startsWith("/wp-content/plugins/") || path.startsWith("/wp-content/themes/") && !path.startsWith("/wp-content/themes/twentytwentytwo/");
};

// packages/wordpress-wasm/src/service-worker.js
(0, import_php_wasm_browser2.initializeServiceWorker)({
  broadcastChannel: new BroadcastChannel("wordpress-wasm"),
  shouldForwardRequestToPHPServer
});
function shouldForwardRequestToPHPServer(request, unscopedUrl) {
  const path = unscopedUrl.pathname;
  return !path.startsWith("/plugin-proxy") && ((0, import_php_wasm_browser2.seemsLikeAPHPServerPath)(path) || isUploadedFilePath(path));
}
