import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

export async function getImagickExtensionModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<any> {
	/**
	 * Hack: Keeping the path working in both
	 * the source file and the final bundle requires
	 * ESBuild and Vite to rewrite the below path.
	 * Vite will return the imagick extension's
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
						`../../../jspi/extensions/imagick/8_4/imagick.so?url`
					)
				).default;
			case '8.3':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/imagick/8_3/imagick.so?url`
					)
				).default;
			case '8.2':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/imagick/8_2/imagick.so?url`
					)
				).default;
			case '8.1':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/imagick/8_1/imagick.so?url`
					)
				).default;
			case '8.0':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/imagick/8_0/imagick.so?url`
					)
				).default;
			case '7.4':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/imagick/7_4/imagick.so?url`
					)
				).default;
			case '7.3':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/imagick/7_3/imagick.so?url`
					)
				).default;
			case '7.2':
				return (
					await import(
						// @ts-ignore
						`../../../jspi/extensions/imagick/7_2/imagick.so?url`
					)
				).default;
		}
	} else {
		switch (version) {
			case '8.4':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/8_4/imagick.so?url`
					)
				).default;
			case '8.3':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/8_3/imagick.so?url`
					)
				).default;
			case '8.2':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/8_2/imagick.so?url`
					)
				).default;
			case '8.1':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/8_1/imagick.so?url`
					)
				).default;
			case '8.0':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/8_0/imagick.so?url`
					)
				).default;
			case '7.4':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/7_4/imagick.so?url`
					)
				).default;
			case '7.3':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/7_3/imagick.so?url`
					)
				).default;
			case '7.2':
				return (
					await import(
						// @ts-ignore
						`../../../asyncify/extensions/imagick/7_2/imagick.so?url`
					)
				).default;
		}
	}
}
