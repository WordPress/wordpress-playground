export const supportedPHPExtensions = ['iconv', 'mbstring', 'xml-bundle', 'gd'] as const;
export type SupportedPHPExtension = (typeof supportedPHPExtensions)[number];
export const SupportedPHPExtensionsList =
	supportedPHPExtensions as any as SupportedPHPExtension[];

export const SupportedPHPExtensionBundles = {
	'kitchen-sink': supportedPHPExtensions,
} as const;
export type SupportedPHPExtensionBundle =
	keyof typeof SupportedPHPExtensionBundles;
