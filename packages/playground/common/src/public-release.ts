/** Find an immutable deployment root without changing the public document URL. */
export function getReleaseRoot(url: URL): URL | undefined {
	const match = /^\/releases\/(release\.[a-zA-Z0-9]+)\//.exec(url.pathname);
	return match ? new URL(`/releases/${match[1]}/`, url) : undefined;
}
