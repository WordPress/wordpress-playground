import type { PHPLoaderModule } from '@php-wasm/universal';

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	// @ts-ignore
	return await import('../jspi/php_8_1.js');
}

export async function getIntlExtensionPath(): Promise<string> {
	// @ts-ignore
	return (await import('../jspi/extensions/intl/8_1/intl.so?url')).default;
}
