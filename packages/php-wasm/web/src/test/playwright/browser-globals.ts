import {
	PHP,
	PHPRequestHandler,
	proxyFileSystem,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { generateCertificate, loadWebRuntime } from '../../lib';

declare global {
	interface Window {
		PHP: typeof PHP;
		PHPRequestHandler: typeof PHPRequestHandler;
		loadWebRuntime: typeof loadWebRuntime;
		proxyFileSystem: typeof proxyFileSystem;
		setPhpIniEntries: typeof setPhpIniEntries;
		generateCertificate: typeof generateCertificate;
	}
}

window.PHP = PHP;
window.PHPRequestHandler = PHPRequestHandler;
window.loadWebRuntime = loadWebRuntime;
window.proxyFileSystem = proxyFileSystem;
window.setPhpIniEntries = setPhpIniEntries;
window.generateCertificate = generateCertificate;
