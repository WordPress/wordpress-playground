import { isParentOf, joinPaths } from '@php-wasm/util';

/** The producer owns these paths, even when a newer worker controls its document. */
export function runtimeStaticAssetsDirectory(details: {
	staticAssetsDirectory?: string;
	releaseBase?: string;
}): string | undefined {
	return details.staticAssetsDirectory
		? joinPaths(
				'.',
				details.releaseBase ?? '/',
				details.staticAssetsDirectory
			)
		: undefined;
}

/** Legacy aliases live on the app; retained release files exist on either host. */
export function wordPressStaticAssetOrigin(
	directory: string,
	workerOrigin: string,
	appOrigin: string
): string {
	return isParentOf('/releases', joinPaths('/', directory))
		? workerOrigin
		: appOrigin;
}
