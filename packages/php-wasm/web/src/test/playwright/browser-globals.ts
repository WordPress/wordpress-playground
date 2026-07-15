import {
	consumeAPI,
	PHP,
	PHPRequestHandler,
	proxyFileSystem,
	setPhpIniEntries,
} from '@php-wasm/universal';
import {
	certificateToPEM,
	generateCertificate,
	loadWebRuntime,
	spawnPHPWorkerThread,
} from '../../lib';
import readableStreamWorkerUrl from './readable-stream-worker.ts?worker&url';

declare global {
	interface Window {
		PHP: typeof PHP;
		PHPRequestHandler: typeof PHPRequestHandler;
		loadWebRuntime: typeof loadWebRuntime;
		proxyFileSystem: typeof proxyFileSystem;
		setPhpIniEntries: typeof setPhpIniEntries;
		consumeAPI: typeof consumeAPI;
		spawnPHPWorkerThread: typeof spawnPHPWorkerThread;
		readableStreamWorkerUrl: string;
		generateCertificate: typeof generateCertificate;
		certificateToPEM: typeof certificateToPEM;
	}
}

window.PHP = PHP;
window.PHPRequestHandler = PHPRequestHandler;
window.loadWebRuntime = loadWebRuntime;
window.proxyFileSystem = proxyFileSystem;
window.setPhpIniEntries = setPhpIniEntries;
window.consumeAPI = consumeAPI;
window.spawnPHPWorkerThread = spawnPHPWorkerThread;
window.readableStreamWorkerUrl = readableStreamWorkerUrl;
window.generateCertificate = generateCertificate;
window.certificateToPEM = certificateToPEM;
