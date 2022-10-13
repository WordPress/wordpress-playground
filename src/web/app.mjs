import { registerServiceWorker, createWordPressWorker, getWorkerBackend } from './library';
import { wordPressSiteUrl, serviceWorkerUrl, wasmWorkerUrl, wasmWorkerBackend } from './config';

async function init() {
	console.log("[Main] Initializing the workers")

	const tabScope = Math.random().toFixed(16);
	
	const wasmWorker = await createWordPressWorker({
		backend: getWorkerBackend( wasmWorkerBackend, wasmWorkerUrl ),
		wordPressSiteUrl: wordPressSiteUrl,
		scope: tabScope
	});
	await registerServiceWorker({
		url: serviceWorkerUrl,
		// Forward any HTTP requests to a worker to resolve them in another process.
		// This way they won't slow down the UI interactions.
		onRequest: async (request) => {
			return await wasmWorker.HTTPRequest(request);
		},
		scope: tabScope
	});
    console.log("[Main] Workers are ready")

	document.querySelector('#wp').src = wasmWorker.urlFor(`/wp-login.php`);
}
init();
