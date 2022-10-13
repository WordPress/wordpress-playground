import { runWordPress } from './library';
import { wasmWorkerUrl, wasmWorkerBackend, wordPressSiteUrl, serviceWorkerUrl,  } from './config';

async function init() {
	console.log("[Main] Starting WordPress...")

	const wasmWorker = await runWordPress({
		wasmWorkerBackend,
		wasmWorkerUrl,
		wordPressSiteUrl,
		serviceWorkerUrl,
		assignScope: true
	});

    console.log("[Main] WordPress is running")

	document.querySelector('#wp').src = wasmWorker.urlFor(`/wp-login.php`);
}
init();
