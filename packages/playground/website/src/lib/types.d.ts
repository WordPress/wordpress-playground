// Defined in vite.config.ts
declare module 'virtual:website-config' {
	export const remotePlaygroundOrigin: string;
	export const buildVersion: string;
}

declare module 'virtual:cors-proxy-url' {
	export const corsProxyUrl: string;
}

declare module 'virtual:website-defaults' {
	export const defaultBlueprintUrl: string | undefined;
	export const defaultStorageType: 'none' | 'opfs' | 'local-fs';
	export const personalWPSiteSlug: string | undefined;
}
