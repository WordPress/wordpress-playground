// Defined in vite.config.ts
declare module 'virtual:website-config' {
	export const remotePlaygroundOrigin: string;
	export const buildVersion: string;
}

declare module 'virtual:cors-proxy-url' {
	export const corsProxyUrl: string;
}

declare module 'virtual:personal-wp-usage-stats' {
	export const personalWpUsageStatsEndpoint: string | undefined;
	export const personalWpUsageStatsHost: string | undefined;
}

declare module 'virtual:website-defaults' {
	export const defaultBlueprintUrl: string | undefined;
	export const defaultStorageType: 'none' | 'opfs' | 'local-fs';
	export const personalWPSiteSlug: string | undefined;
}

declare module '*?worker&url' {
	const workerUrl: string;
	export default workerUrl;
}
