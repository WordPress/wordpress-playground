import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

export async function getIntlExtensionModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<any> {
	/**
	 * Keeping the path working in both
	 * the source file and the final bundle requires
	 * ESBuild and Vite to rewrite the below path.
	 * Vite will return the intl extension's
	 * absolute path during tests while ESBuild
	 * returns a resolved path between __dirname and
	 * the extension's relative path during build
	 * since target directories are not identically
	 * located in built and unbuilt versions.
	 * Hack: Dynamic imports must be static for bundlers,
	 * so we hack around this by enumerating each
	 * version explicitly.
	 */
	if (await jspi()) {
		switch (version) {
			case '8.4':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/8_4/intl.so?url`
					)
				).default;
			case '8.3':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/8_3/intl.so?url`
					)
				).default;
			case '8.2':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/8_2/intl.so?url`
					)
				).default;
			case '8.1':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/8_1/intl.so?url`
					)
				).default;
			case '8.0':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/8_0/intl.so?url`
					)
				).default;
			case '7.4':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/7_4/intl.so?url`
					)
				).default;
			case '7.3':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/7_3/intl.so?url`
					)
				).default;
			case '7.2':
				return (
					await import(
						// @ts-ignore
						`../../../../jspi/extensions/intl/7_2/intl.so?url`
					)
				).default;
		}
	} else {
		switch (version) {
			case '8.4':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/8_4/intl.so?url`
					)
				).default;
			case '8.3':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/8_3/intl.so?url`
					)
				).default;
			case '8.2':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/8_2/intl.so?url`
					)
				).default;
			case '8.1':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/8_1/intl.so?url`
					)
				).default;
			case '8.0':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/8_0/intl.so?url`
					)
				).default;
			case '7.4':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/7_4/intl.so?url`
					)
				).default;
			case '7.3':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/7_3/intl.so?url`
					)
				).default;
			case '7.2':
				return (
					await import(
						// @ts-ignore
						`../../../../asyncify/extensions/intl/7_2/intl.so?url`
					)
				).default;
		}
	}
}
