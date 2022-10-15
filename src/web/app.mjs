import { runWordPress } from "./library";
import {
  wasmWorkerUrl,
  wasmWorkerBackend,
  wordPressSiteUrl,
  serviceWorkerUrl,
} from "./config";

window.startWordPress = async function (options = {}) {
  console.log("[Main] Starting WordPress...");

  const wasmWorker = await runWordPress({
    wasmWorkerBackend,
    wasmWorkerUrl,
    wordPressSiteUrl,
    serviceWorkerUrl,
    assignScope: true,
    onWasmDownloadProgress: options.onWasmDownloadProgress,
  });

  console.log("[Main] WordPress is running");
  return wasmWorker;
};
