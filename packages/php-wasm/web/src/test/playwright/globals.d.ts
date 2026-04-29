import type {
	PHP,
	PHPRequestHandler,
	proxyFileSystem,
	setPhpIniEntries,
} from '@php-wasm/universal';
import type { loadWebRuntime, generateCertificate } from '../../lib';

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
