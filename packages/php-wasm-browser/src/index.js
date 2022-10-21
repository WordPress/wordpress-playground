
export { initializeWorkerThread, loadPHPWithProgress } from './worker-thread';
export { startPHPWorkerThread, getWorkerThreadBackend } from './worker-thread-api';
export { registerServiceWorker, initializeServiceWorker, isPHPFile } from './service-worker';
export { postMessageExpectReply, awaitReply, responseTo, messageHandler } from './messaging';

// @TODO:

	// The content-length header may be missing when the files are
	// compressed before transmission.
	// These fallback values are generated during the build process.
	// if(!e.detail.total) {
	// 	if(e.detail.file === 'php-web.wasm') {
	// 		e.detail.total = phpWebWasmSize;
	// 	} else if(e.detail.file === 'wp.data') {
	// 		e.detail.total = wpDataSize;
	// 	}
	// }

