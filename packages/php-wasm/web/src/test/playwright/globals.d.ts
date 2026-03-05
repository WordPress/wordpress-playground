import type { PHP } from '@php-wasm/universal';
import type { loadWebRuntime } from '../../lib';

declare global {
	interface Window {
		PHP: typeof PHP;
		loadWebRuntime: typeof loadWebRuntime;
		proxyFileSystem: typeof proxyFileSystem;
	}
}
