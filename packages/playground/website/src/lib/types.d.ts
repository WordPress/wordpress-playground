// Defined in vite.config.ts
declare module 'virtual:website-config' {
	export const remotePlaygroundOrigin: string;
	export const buildVersion: string;
}

// Defined in vite.config.ts
declare module 'virtual:blueprints-directory-url' {
	/**
	 * Base URL of the WordPress/blueprints directory, without a trailing
	 * slash. `undefined` means the same-origin mirror at `/blueprints`.
	 */
	export const blueprintsDirectoryUrl: string | undefined;
}
