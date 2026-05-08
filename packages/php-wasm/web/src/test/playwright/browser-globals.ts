import {
	PHP,
	PHPRequestHandler,
	proxyFileSystem,
	setPhpIniEntries,
} from '@php-wasm/universal';
import {
	certificateToPEM,
	generateCertificate,
	loadWebRuntime,
} from '../../lib';

declare global {
	interface Window {
		PHP: typeof PHP;
		PHPRequestHandler: typeof PHPRequestHandler;
		loadWebRuntime: typeof loadWebRuntime;
		proxyFileSystem: typeof proxyFileSystem;
		setPhpIniEntries: typeof setPhpIniEntries;
		generateCertificate: typeof generateCertificate;
		certificateToPEM: typeof certificateToPEM;
	}
}

window.PHP = PHP;
window.PHPRequestHandler = PHPRequestHandler;
window.loadWebRuntime = loadWebRuntime;
window.proxyFileSystem = proxyFileSystem;
window.setPhpIniEntries = setPhpIniEntries;
window.generateCertificate = generateCertificate;
window.certificateToPEM = certificateToPEM;
