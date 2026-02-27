import type { PHPLoaderModule } from '@php-wasm/universal';

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	// @ts-ignore
	return await import('../jspi/php_7_4.js');
}

export async function getIntlExtensionPath(): Promise<string> {
	// @ts-ignore
	return (await import('../jspi/extensions/intl/intl.so?url')).default;
}
