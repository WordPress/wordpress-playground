import {
	LatestSupportedPHPVersion,
	PHPLoaderModule,
	SupportedPHPVersion,
} from '@php-wasm/universal';

/**
 * Loads the PHP loader module for the given PHP version.
 *
 * @param version The PHP version to load.
 * @param variant Internal. Do not use.
 * @returns The PHP loader module.
 */
export async function getPHPLoaderModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion,
	variant: 'light' | 'regular' = 'light'
): Promise<PHPLoaderModule> {
	if (variant === 'regular') {
		switch (version) {
			case '8.2':
				// @ts-ignore
				return await import('../../public/regular/php_8_2.js');
			case '8.1':
				// @ts-ignore
				return await import('../../public/regular/php_8_1.js');
			case '8.0':
				// @ts-ignore
				return await import('../../public/regular/php_8_0.js');
			case '7.4':
				// @ts-ignore
				return await import('../../public/regular/php_7_4.js');
			case '7.3':
				// @ts-ignore
				return await import('../../public/regular/php_7_3.js');
			case '7.2':
				// @ts-ignore
				return await import('../../public/regular/php_7_2.js');
			case '7.1':
				// @ts-ignore
				return await import('../../public/regular/php_7_1.js');
			case '7.0':
				// @ts-ignore
				return await import('../../public/regular/php_7_0.js');
			case '5.6':
				// @ts-ignore
				return await import('../../public/regular/php_5_6.js');
		}
	} else {
		switch (version) {
			case '8.2':
				// @ts-ignore
				return await import('../../public/light/php_8_2.js');
			case '8.1':
				// @ts-ignore
				return await import('../../public/light/php_8_1.js');
			case '8.0':
				// @ts-ignore
				return await import('../../public/light/php_8_0.js');
			case '7.4':
				// @ts-ignore
				return await import('../../public/light/php_7_4.js');
			case '7.3':
				// @ts-ignore
				return await import('../../public/light/php_7_3.js');
			case '7.2':
				// @ts-ignore
				return await import('../../public/light/php_7_2.js');
			case '7.1':
				// @ts-ignore
				return await import('../../public/light/php_7_1.js');
			case '7.0':
				// @ts-ignore
				return await import('../../public/light/php_7_0.js');
			case '5.6':
				// @ts-ignore
				return await import('../../public/light/php_5_6.js');
		}
	}
	throw new Error(`Unsupported PHP version ${version}`);
}
