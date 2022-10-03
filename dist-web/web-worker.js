(() => {
  // src/web/web-worker.js
  console.log("[WebWorker] Spawned");
  importScripts("/webworker-php.js");
  new PHP({}).then(() => {
    console.log("[WebWorker] PHP initialized");
  });
})();
