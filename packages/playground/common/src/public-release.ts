/** Find an immutable deployment root without changing the public document URL. */
export function getReleaseRoot(url: URL): URL | undefined {
	const release = getReleaseId(url);
	return release ? new URL(`/releases/${release}/`, url) : undefined;
}

/** The immutable URL is the identity of the code being executed. */
export function getReleaseId(url: URL): string | undefined {
	return /^\/releases\/(release\.[a-zA-Z0-9]+)\//.exec(url.pathname)?.[1];
}
