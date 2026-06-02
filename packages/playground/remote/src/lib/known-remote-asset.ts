import { joinPaths } from '@php-wasm/util';
import { applyRewriteRules } from '@php-wasm/universal';
import { wordPressRewriteRules } from '@wp-playground/wordpress';

export type WPModuleDetails = {
	staticAssetsDirectory?: string;
	remoteAssetPaths?: string[];
};

export function resolveKnownRemoteAssetUrl(
	unscopedUrl: URL,
	{ staticAssetsDirectory, remoteAssetPaths }: WPModuleDetails
) {
	if (!staticAssetsDirectory || !remoteAssetPaths?.length) {
		return undefined;
	}

	const siteRelativePath = applyRewriteRules(
		unscopedUrl.pathname,
		wordPressRewriteRules
	);
	const normalizedPath = joinPaths('/', siteRelativePath);
	if (normalizedPath === '/' || !remoteAssetPaths.includes(normalizedPath)) {
		return undefined;
	}

	const remoteAssetUrl = new URL(unscopedUrl);
	remoteAssetUrl.pathname = joinPaths(
		'/',
		staticAssetsDirectory,
		siteRelativePath
	);
	return remoteAssetUrl;
}
