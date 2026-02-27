import type { PHPLoaderModule } from '@php-wasm/universal';

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	// @ts-ignore
	return await import('../jspi/php_7_4.js');
}

export async function getIntlExtensionPath(): Promise<string> {
	// @ts-ignore
	return (await import('../jspi/extensions/intl/7_4/intl.so?url')).default;
}
