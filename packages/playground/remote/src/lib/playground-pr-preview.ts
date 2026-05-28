export const playgroundPrParam = 'playground-pr';
export const playgroundPrShaParam = 'playground-pr-sha';
export const playgroundPrPreviewServiceWorkerPath =
	'/playground-pr-preview-sw.js';

export interface PlaygroundPrPreview {
	pr: string;
	sha: string;
	basePath: string;
}

export function getPlaygroundPrPreviewFromUrl(
	url: string | URL
): PlaygroundPrPreview | undefined {
	const parsedUrl = new URL(url);
	const pr = parsedUrl.searchParams.get(playgroundPrParam);
	const sha = parsedUrl.searchParams.get(playgroundPrShaParam);
	if (!pr || !sha || !isValidPlaygroundPrNumber(pr) || !isValidSha(sha)) {
		return undefined;
	}

	if (
		parsedUrl.pathname !== playgroundPrPreviewServiceWorkerPath &&
		parsedUrl.pathname !== getPlaygroundPrPreviewServiceWorkerPath(pr, sha)
	) {
		return undefined;
	}

	return {
		pr,
		sha,
		basePath: getPlaygroundPrPreviewBasePath(pr, sha),
	};
}

export function getPlaygroundPrPreviewServiceWorkerUrl(
	serviceWorkerPath: string,
	origin: string,
	documentUrl: string | URL
): URL {
	const serviceWorkerUrl = new URL(serviceWorkerPath, origin);
	const documentLocation = new URL(documentUrl);
	const pr = documentLocation.searchParams.get(playgroundPrParam);
	const sha = documentLocation.searchParams.get(playgroundPrShaParam);

	if (pr && sha && isValidPlaygroundPrNumber(pr) && isValidSha(sha)) {
		serviceWorkerUrl.pathname = playgroundPrPreviewServiceWorkerPath;
		serviceWorkerUrl.searchParams.set(playgroundPrParam, pr);
		serviceWorkerUrl.searchParams.set(playgroundPrShaParam, sha);
	}

	return serviceWorkerUrl;
}

export function shouldBypassPlaygroundPrPreview(url: URL): boolean {
	return url.pathname.startsWith('/pr-previews/');
}

export function shouldMapToPlaygroundPrPreview(url: URL): boolean {
	const { pathname } = url;
	if (
		pathname.startsWith('/pr-previews/') ||
		pathname.startsWith('/scope:') ||
		pathname.startsWith('/plugin-proxy') ||
		pathname.startsWith('/client/index.js') ||
		pathname.startsWith('/proxy/') ||
		pathname.endsWith('.php')
	) {
		return false;
	}

	return true;
}

export function mapToPlaygroundPrPreviewUrl(
	url: URL,
	preview: PlaygroundPrPreview
): URL {
	const previewUrl = new URL(url);
	const pathWithoutLeadingSlash = url.pathname.replace(/^\//, '');
	previewUrl.pathname = preview.basePath + pathWithoutLeadingSlash;
	return previewUrl;
}

function getPlaygroundPrPreviewBasePath(pr: string, sha: string) {
	return `/pr-previews/${pr}/${sha}/`;
}

function getPlaygroundPrPreviewServiceWorkerPath(pr: string, sha: string) {
	return `${getPlaygroundPrPreviewBasePath(pr, sha)}sw.js`;
}

function isValidPlaygroundPrNumber(pr: string) {
	return /^\d+$/.test(pr);
}

function isValidSha(sha: string) {
	return /^[a-f0-9]{7,40}$/i.test(sha);
}
