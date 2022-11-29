// packages/wordpress-wasm/src/index.js
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

// packages/wordpress-wasm/src/macros.js
async function login(workerThread, user = "admin", password = "password") {
  await workerThread.HTTPRequest({
    path: workerThread.pathToInternalUrl("/wp-login.php")
  });
  await workerThread.HTTPRequest({
    path: workerThread.pathToInternalUrl("/wp-login.php"),
    method: "POST",
    _POST: {
      log: user,
      pwd: password,
      rememberme: "forever"
    }
  });
}
async function installPlugin(workerThread, pluginZipFile, options = {}) {
  options = {
    activate: true,
    ...options
  };
  const pluginForm = await workerThread.HTTPRequest({
    path: workerThread.pathToInternalUrl("/wp-admin/plugin-install.php?tab=upload")
  });
  const pluginFormPage = new DOMParser().parseFromString(pluginForm.body, "text/html");
  const pluginFormData = new FormData(pluginFormPage.querySelector(".wp-upload-form"));
  const { pluginzip, ...postData } = Object.fromEntries(pluginFormData.entries());
  if (options.activate) {
    const pluginInstalledResponse = await workerThread.HTTPRequest({
      path: workerThread.pathToInternalUrl("/wp-admin/update.php?action=upload-plugin"),
      method: "POST",
      _POST: postData,
      files: { pluginzip: pluginZipFile }
    });
    const pluginInstalledPage = new DOMParser().parseFromString(pluginInstalledResponse.body, "text/html");
    const activateButtonHref = pluginInstalledPage.querySelector("#wpbody-content .button.button-primary").attributes.href.value;
    const activatePluginUrl = new URL(
      activateButtonHref,
      workerThread.pathToInternalUrl("/wp-admin/")
    ).toString();
    await workerThread.HTTPRequest({
      path: activatePluginUrl
    });
  }
}

// packages/wordpress-wasm/src/example-app.js
var import_php_wasm_browser2 = require("php-wasm-browser");
function setupAddressBar(wasmWorker) {
  const addressBar = document.querySelector("#address-bar");
  wpFrame.addEventListener("load", (e) => {
    addressBar.value = wasmWorker.internalUrlToPath(
      e.currentTarget.contentWindow.location.href
    );
  });
  document.querySelector("#address-bar-form").addEventListener("submit", (e) => {
    e.preventDefault();
    let requestedPath = addressBar.value;
    const isDirectory = !requestedPath.split("/").pop().includes(".");
    if (isDirectory && !requestedPath.endsWith("/")) {
      requestedPath += "/";
    }
    wpFrame.src = wasmWorker.pathToInternalUrl(
      requestedPath
    );
  });
}
var FetchProgressBar = class {
  constructor({
    expectedRequests,
    min = 0,
    max = 100
  }) {
    this.expectedRequests = expectedRequests;
    this.progress = {};
    this.min = min;
    this.max = max;
    this.el = document.querySelector(".progress-bar.is-finite");
    const wpFrame2 = document.querySelector("#wp");
    const hideProgressBar = () => {
      document.querySelector("body.is-loading").classList.remove("is-loading");
      wpFrame2.removeEventListener("load", hideProgressBar);
    };
    wpFrame2.addEventListener("load", hideProgressBar);
  }
  onDataChunk = ({ file, loaded, total }) => {
    if (Object.keys(this.progress).length === 0) {
      this.setFinite();
    }
    this.progress[file] = loaded / total;
    const progressSum = Object.entries(this.progress).reduce(
      (acc, [_, percentFinished]) => acc + percentFinished,
      0
    );
    const totalProgress = Math.min(1, progressSum / this.expectedRequests);
    const scaledProgressPercentage = this.min + (this.max - this.min) * totalProgress;
    this.setProgress(scaledProgressPercentage);
  };
  setProgress(percent) {
    this.el.style.width = `${percent}%`;
  }
  setFinite() {
    const classList = document.querySelector(
      ".progress-bar-wrapper.mode-infinite"
    ).classList;
    classList.remove("mode-infinite");
    classList.add("mode-finite");
  }
};
var wpFrame = document.querySelector("#wp");
async function main() {
  const preinstallPlugin = query.get("plugin");
  let progressBar;
  let pluginResponse;
  if (preinstallPlugin) {
    pluginResponse = await fetch("/plugin-proxy?plugin=" + preinstallPlugin);
    progressBar = new FetchProgressBar({
      expectedRequests: 3,
      max: 80
    });
  } else {
    progressBar = new FetchProgressBar({ expectedRequests: 2 });
  }
  const workerThread = await bootWordPress({
    onWasmDownloadProgress: progressBar.onDataChunk
  });
  if (appMode === "browser") {
    setupAddressBar(workerThread);
  }
  if (preinstallPlugin) {
    const progressPluginResponse = (0, import_php_wasm_browser2.cloneResponseMonitorProgress)(
      pluginResponse,
      (progress) => progressBar.onDataChunk({ file: preinstallPlugin, ...progress })
    );
    const blob = await progressPluginResponse.blob();
    const pluginFile = new File([blob], preinstallPlugin);
    progressBar.el.classList.add("indeterminate");
    progressBar.setProgress(80);
    progressBar.setProgress(85);
    await login(workerThread, "admin", "password");
    progressBar.setProgress(100);
    await installPlugin(workerThread, pluginFile);
  }
  if (query.get("rpc")) {
    console.log("Registering an RPC handler");
    window.addEventListener("message", (0, import_php_wasm_browser2.postMessageHandler)(async (data) => {
      if (data.type === "rpc") {
        return await workerThread[data.method](...data.args);
      } else if (data.type === "go_to") {
        wpFrame.src = workerThread.pathToInternalUrl(data.path);
      } else if (data.type === "is_alive") {
        return true;
      }
    }));
  }
  const initialUrl = query.get("url") || "/";
  wpFrame.src = workerThread.pathToInternalUrl(initialUrl);
}
main();
