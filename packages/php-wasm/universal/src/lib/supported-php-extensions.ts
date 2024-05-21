// The extensions list is repeated on purpose to avoid CI errors
// @see https://github.com/WordPress/wordpress-playground/pull/687
export type SupportedPHPExtension = 'iconv' | 'mbstring' | 'xml-bundle' | 'gd';
export const SupportedPHPExtensionsList = [
	'iconv',
	'mbstring',
	'xml-bundle',
	'gd',
];

export const SupportedPHPExtensionBundles = {
	'kitchen-sink': SupportedPHPExtensionsList,
	light: [],
};
export type SupportedPHPExtensionBundle = 'kitchen-sink' | 'light';
