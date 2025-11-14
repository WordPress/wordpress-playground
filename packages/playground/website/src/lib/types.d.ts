// Defined in vite.config.ts
declare module 'virtual:website-config' {
	export const remotePlaygroundOrigin: string;
	export const buildVersion: string;
}

// Defined in vite.config.ts
declare module 'virtual:cors-proxy-url' {
	export const corsProxyUrl: string;
}
