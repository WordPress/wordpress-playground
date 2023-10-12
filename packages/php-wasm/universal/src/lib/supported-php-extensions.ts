export type SupportedPHPExtension = 'mbstring' | 'xml-bundle' | 'gd';
export const SupportedPHPExtensionsList = ['mbstring', 'xml-bundle', 'gd'];

export const SupportedPHPExtensionBundles = {
	'kitchen-sink': ['mbstring', 'xml-bundle', 'gd'],
};
export type SupportedPHPExtensionBundle = 'kitchen-sink';
