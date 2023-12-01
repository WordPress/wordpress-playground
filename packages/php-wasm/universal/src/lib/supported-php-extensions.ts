const supportedPHPExtensions = ['mbstring', 'xml-bundle', 'gd'] as const;
export type SupportedPHPExtension = (typeof supportedPHPExtensions)[number];
export const SupportedPHPExtensionsList =
	supportedPHPExtensions as any as SupportedPHPExtension[];
