export const SupportedWordPressVersions = [
	'6.2',
	'6.1',
	'6.0',
	'5.9',
	'nightly',
] as const;
export type SupportedWordPressVersion =
	(typeof SupportedWordPressVersions)[number];
export const LatestSupportedWordPressVersion = SupportedWordPressVersions[0];
export const SupportedWordPressVersionsList =
	SupportedWordPressVersions as any as string[];

export function getWordPressModule(wpVersion: string) {
	switch (wpVersion) {
		case '5.9':
			/** @ts-ignore */
			return import('../wordpress/wp-5.9.js');
		case '6.0':
			/** @ts-ignore */
			return import('../wordpress/wp-6.0.js');
		case '6.1':
			/** @ts-ignore */
			return import('../wordpress/wp-6.1.js');
		case '6.2':
			/** @ts-ignore */
			return import('../wordpress/wp-6.2.js');
		case 'nightly':
			/** @ts-ignore */
			return import('../wordpress/wp-nightly.js');
	}
	throw new Error(`Unsupported WordPress module: ${wpVersion}`);
}
