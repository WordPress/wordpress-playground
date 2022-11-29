var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/wordpress-wasm/src/index.js
var src_exports = {};
__export(src_exports, {
  bootWordPress: () => bootWordPress,
  isUploadedFilePath: () => isUploadedFilePath
});
module.exports = __toCommonJS(src_exports);
var import_php_wasm_browser = require("php-wasm-browser");

// packages/wordpress-wasm/src/config.js
var import_php_wasm = require("php-wasm");
var import_php_wasm2 = require("php-wasm");
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
  const workerThread = await (0, import_php_wasm_browser.startPHPWorkerThread)({
    backend: (0, import_php_wasm_browser.getWorkerThreadBackend)(wasmWorkerBackend, wasmWorkerUrl),
    absoluteUrl: wordPressSiteUrl,
    scope,
    onDownloadProgress: onWasmDownloadProgress
  });
  await (0, import_php_wasm_browser.registerServiceWorker)({
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
