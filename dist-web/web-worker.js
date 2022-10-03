(() => {
  // src/web/web-worker.js
  console.log("[WebWorker] Spawned");
  document = {};
  importScripts("/webworker-php.js");
  new PHP({}).then(() => {
    console.log("[WebWorker] PHP initialized");
  });
})();
