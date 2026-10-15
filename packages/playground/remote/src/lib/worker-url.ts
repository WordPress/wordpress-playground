/** Worker entry scripts must use the executing page's origin, even with shared assets. */
export function sameOriginWorkerUrl(
	assetUrl: string,
	pageUrl = globalThis.location.href
): URL {
	const page = new URL(pageUrl);
	const url = new URL(assetUrl, page);
	url.host = page.host;
	url.protocol = page.protocol;
	return url;
}
