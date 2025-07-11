import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

export async function getXdebugExtensionModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<any> {
	/**
	 * Hack: Keeping the path working in both
	 * the source file and the final bundle requires
	 * ESBuild and Vite to rewrite the below path.
	 * Vite will return the xdebug extension's
	 * absolute path during tests while ESBuild
	 * returns a resolved path between __dirname and
	 * the extension's relative path during build
	 * since target directories are not identically
	 * located in built and unbuilt versions.
	 */
	if (await jspi()) {
		switch (version) {
			case '8.4':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/8_4/xdebug.so?url`
					)
				).default;
			case '8.3':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/8_3/xdebug.so?url`
					)
				).default;
			case '8.2':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/8_2/xdebug.so?url`
					)
				).default;
			case '8.1':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/8_1/xdebug.so?url`
					)
				).default;
			case '8.0':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/8_0/xdebug.so?url`
					)
				).default;
			case '7.4':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/7_4/xdebug.so?url`
					)
				).default;
			case '7.3':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/7_3/xdebug.so?url`
					)
				).default;
			case '7.2':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/xdebug/7_2/xdebug.so?url`
					)
				).default;
		}
	} else {
		switch (version) {
			case '8.4':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/8_4/xdebug.so?url`
					)
				).default;
			case '8.3':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/8_3/xdebug.so?url`
					)
				).default;
			case '8.2':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/8_2/xdebug.so?url`
					)
				).default;
			case '8.1':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/8_1/xdebug.so?url`
					)
				).default;
			case '8.0':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/8_0/xdebug.so?url`
					)
				).default;
			case '7.4':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/7_4/xdebug.so?url`
					)
				).default;
			case '7.3':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/7_3/xdebug.so?url`
					)
				).default;
			case '7.2':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/xdebug/7_2/xdebug.so?url`
					)
				).default;
		}
	}
}
