import { registerServiceWorker, createWordPressWorker, iframeBackend } from './library';

async function init() {
	console.log("[Main] Initializing the workers")
	const wasmWorker = await createWordPressWorker(
		{
			backend: iframeBackend("http://127.0.0.1:8778/iframe-worker.html"),
			// backend: webWorkerBackend("/wasm-worker.js"),
			// backend: sharedWorkerBackend("/wasm-worker.js"),
			wordPressSiteURL: location.href
		}
	);
	await registerServiceWorker(
		`http://localhost:8777/service-worker.js`,
		async (request) => {
			// Forward any HTTP requests to a worker to resolve them in another process.
			// This way they won't slow down the UI interactions.
			return await wasmWorker.HTTPRequest(request);
		}
	);
    console.log("[Main] Workers are ready")

	document.querySelector('#wp').src = '/wp-login.php';
}
init();
