import { registerServiceWorker, createWordPressWorker, iframeBackend } from './library';

async function init() {
	console.log("[Main] Initializing the workers")
	
	const serviceWorkerOrigin = location.origin;
	const wasmWorkerOrigin = 'http://127.0.0.1:8778';

	const wasmWorker = await createWordPressWorker(
		{
			backend: iframeBackend(`${wasmWorkerOrigin}/iframe-worker.html`),
			// backend: webWorkerBackend("/wasm-worker.js"),
			// backend: sharedWorkerBackend("/wasm-worker.js"),
			wordPressSiteURL: serviceWorkerOrigin
		}
	);
	await registerServiceWorker(
		`${serviceWorkerOrigin}/service-worker.js`,
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
