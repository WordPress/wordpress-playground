export type SupportedPHPExtension = 'iconv' | 'mbstring' | 'xml-bundle' | 'gd';
export const SupportedPHPExtensionsList = ['iconv', 'mbstring', 'xml-bundle', 'gd'];

export const SupportedPHPExtensionBundles = {
	'kitchen-sink': SupportedPHPExtensionsList,
};
export type SupportedPHPExtensionBundle = 'kitchen-sink';
