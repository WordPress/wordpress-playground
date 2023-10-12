export type SupportedPHPExtension = 'mbstring' | 'xml-bundle' | 'gd';
export const SupportedPHPExtensionsList = ['mbstring', 'xml-bundle', 'gd'];

export const SupportedPHPExtensionBundles = {
	'kitchen-sink': SupportedPHPExtensionsList,
} as const;
export type SupportedPHPExtensionBundle =
	keyof typeof SupportedPHPExtensionBundles;
