export type SupportedPHPExtension = 'iconv' | 'mbstring' | 'xml-bundle' | 'gd';
export const SupportedPHPExtensionsList = ['iconv', 'mbstring', 'xml-bundle', 'gd'];

export const SupportedPHPExtensionBundles = {
	'kitchen-sink': ['mbstring', 'xml-bundle', 'gd'],
};
export type SupportedPHPExtensionBundle = 'kitchen-sink';
