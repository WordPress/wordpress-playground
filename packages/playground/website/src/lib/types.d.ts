// Defined in vite.config.ts
declare module 'virtual:website-config' {
	export const remotePlaygroundOrigin: string;
	export const buildVersion: string;
}

// Defined in vite.config.ts
declare module 'virtual:blueprints-directory-url' {
	/**
	 * Base URL of the WordPress/blueprints directory: absolute, or a path
	 * relative to the website origin. `undefined` means the same-origin
	 * mirror at `/blueprints`.
	 */
	export const blueprintsDirectoryUrl: string | undefined;
}
