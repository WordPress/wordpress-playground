(() => {
  // src/web/web-worker.js
  console.log("[WebWorker] Spawned");
  importScripts("/webworker-php.js");
  new EmscriptenPHPModule({});
  console.log("[WebWorker] PHP initializing");
})();
