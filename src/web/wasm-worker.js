/* eslint-disable no-inner-declarations */

import PHPWrapper from "../shared/php-wrapper.mjs";
import WordPress from "../shared/wordpress.mjs";
import WPBrowser from "../shared/wp-browser.mjs";
import { responseTo } from "../shared/messaging.mjs";

console.log("[WASM Worker] Spawned");

// Infer the environment
const IS_IFRAME = typeof window !== "undefined";
// eslint-disable-next-line no-undef
const IS_SHARED_WORKER =
  typeof SharedWorkerGlobalScope !== "undefined" &&
  self instanceof SharedWorkerGlobalScope;
// eslint-disable-next-line no-undef
const IS_WEBWORKER =
  !IS_SHARED_WORKER &&
  typeof WorkerGlobalScope !== "undefined" &&
  self instanceof WorkerGlobalScope;

console.log("[WASM Worker] Environment", {
  IS_IFRAME,
  IS_WEBWORKER,
  IS_SHARED_WORKER,
});

// Define polyfills
if (IS_IFRAME) {
  // importScripts is synchronous in a web worker.
  // Let's make it async in an iframe so we can at await it before moving forward.
  window.importScripts = async function (...urls) {
    return Promise.all(
      urls.map((url) => {
        const script = document.createElement("script");
        script.src = url;
        script.async = false;
        document.body.appendChild(script);
        return new Promise((resolve) => {
          script.onload = resolve;
        });
      })
    );
  };
}

let phpLoaderScriptName;
// Listen to messages
if (IS_IFRAME) {
  phpLoaderScriptName = "/php-web.js";
  window.addEventListener(
    "message",
    (event) =>
      handleMessageEvent(event, (response) =>
        event.source.postMessage(response, "*")
      ),
    false
  );
} else if (IS_WEBWORKER) {
  phpLoaderScriptName = "/php-webworker.js";
  onmessage = (event) => {
    handleMessageEvent(event, postMessage);
  };
} else if (IS_SHARED_WORKER) {
  phpLoaderScriptName = "/php-webworker.js";
  self.onconnect = (e) => {
    const port = e.ports[0];

    port.addEventListener("message", (event) => {
      handleMessageEvent(event, (r) => port.postMessage(r));
    });

    port.start(); // Required when using addEventListener. Otherwise called implicitly by onmessage setter.
  };
}

// Actual worker logic below:

// We're in a worker right now, and we're receiving the incoming
// communication from the main window via `postMessage`:
async function handleMessageEvent(event, respond) {
  console.debug(`[WASM Worker] "${event.data.type}" event received`, event);

  const result = await generateResponseForMessage(event.data);

  // The main window expects a response when it includes a `messageId` in the message:
  if (event.data.messageId) {
    respond(responseTo(event.data.messageId, result));
  }

  console.debug(`[WASM Worker] "${event.data.type}" event processed`);
}

let wpBrowser;
async function generateResponseForMessage(message) {
  if (message.type === "initialize_wordpress") {
    wpBrowser = await initWPBrowser(message.siteURL);
    return true;
  }

  if (message.type === "is_alive") {
    return true;
  }

  if (message.type === "run_php") {
    return await wpBrowser.wp.php.run(message.code);
  }

  if (message.type === "request" || message.type === "httpRequest") {
    const parsedUrl = new URL(message.request.path, wpBrowser.wp.ABSOLUTE_URL);
    return await wpBrowser.request({
      ...message.request,
      path: parsedUrl.pathname,
      _GET: parsedUrl.search,
    });
  }

  console.debug(
    `[WASM Worker] "${message.type}" event has no handler, short-circuiting`
  );
}

async function initWPBrowser(siteUrl) {
  console.log("[WASM Worker] Before wp.init()");

  // Initialize the PHP module
  const php = new PHPWrapper();
  // eslint-disable-next-line no-undef
  await importScripts(phpLoaderScriptName);
  // eslint-disable-next-line no-undef
  const PHPModule = await php.init(PHP);

  // Load the WordPress files
  await new Promise((resolve) => {
    PHPModule.monitorRunDependencies = (nbLeft) => {
      if (nbLeft === 0) {
        delete PHPModule.monitorRunDependencies;
        resolve();
      }
    };
    // The name PHPModule is baked into wp.js
    globalThis.PHPModule = PHPModule;
    // eslint-disable-next-line no-undef
    importScripts("/wp.js");
  });

  // Create php.ini
  PHPModule.FS.mkdirTree("/usr/local/etc");
  PHPModule.FS.writeFile(
    "/usr/local/etc/php.ini",
    `[PHP]
error_reporting = E_ERROR | E_PARSE
display_errors = 1
html_errors = 1
display_startup_errors = On
	`
  );

  // We're ready to initialize WordPress!
  const wp = new WordPress(php);
  await wp.init(siteUrl);

  console.log("[WASM Worker] After wp.init()");

  return new WPBrowser(wp, { handleRedirects: true });
}
