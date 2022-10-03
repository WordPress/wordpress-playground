(() => {
  // src/web/web-worker.js
  console.log("[WebWorker] Spawned");
  document = {};
  importScripts("/webworker-php.js");
})();
