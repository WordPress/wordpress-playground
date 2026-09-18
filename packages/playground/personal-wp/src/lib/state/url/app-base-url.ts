export function getAppBaseUrl(): URL {
	return new URL(import.meta.env.BASE_URL, window.location.origin);
}

export function isAppBasePath(pathname: string): boolean {
	return (
		trimTrailingSlash(pathname) ===
		trimTrailingSlash(getAppBaseUrl().pathname)
	);
}

function trimTrailingSlash(pathname: string): string {
	return pathname === '/' ? pathname : pathname.replace(/\/$/, '');
}
