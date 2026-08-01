import type { PHPWebExtension } from '@php-wasm/web';

/**
 * Converts Query API `php-extension` values into runtime extension requests.
 *
 * The browser runtime accepts absolute manifest URLs. Query API callers may use
 * absolute, root-relative, or page-relative URLs; all are normalized here before
 * the PHP runtime starts.
 */
export function phpExtensionQueryArgsToExtensionsArray(
	manifestUrls: string | string[] | undefined,
	baseUrl: string | URL
): PHPWebExtension[] {
	let urls: string[] = [];
	if (typeof manifestUrls === 'string') {
		urls = [manifestUrls];
	} else if (manifestUrls) {
		urls = manifestUrls;
	}
	return urls
		.map((manifestUrl) => manifestUrl.trim())
		.map((manifestUrl) =>
			phpExtensionManifestUrlToExtension(manifestUrl, baseUrl)
		);
}

function phpExtensionManifestUrlToExtension(
	manifestUrl: string,
	baseUrl: string | URL
): PHPWebExtension {
	if (!manifestUrl) {
		throw new Error(
			'Invalid php-extension query parameter: expected a manifest URL.'
		);
	}

	let resolvedManifestUrl: URL;
	try {
		resolvedManifestUrl = new URL(manifestUrl, baseUrl);
	} catch {
		throw new Error(
			`Invalid php-extension query parameter: "${manifestUrl}" is not a URL.`
		);
	}

	if (!['http:', 'https:'].includes(resolvedManifestUrl.protocol)) {
		throw new Error(
			'Invalid php-extension query parameter: manifest URL must use ' +
				`http: or https:. Received "${resolvedManifestUrl.protocol}".`
		);
	}

	return {
		source: {
			format: 'manifest',
			manifestUrl: resolvedManifestUrl.toString(),
		},
	};
}
