export interface PhpVersion {
	version: string;
	loaderFilename: string;
	wasmFilename: string;
	lastRelease: string;
}

export const lastRefreshed: string;
export const phpVersions: PhpVersion[];
