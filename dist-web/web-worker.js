(() => {
  // src/web/web-worker.js
  console.log("[WebWorker] Spawned");
  document = {};
  importScripts("/webworker-php.js");
  new PHP({}).then(({ ccall }) => {
    ccall("pib_init", "number", ["string"], []);
    console.log("[WebWorker] PHP initialized");
  });
})();
