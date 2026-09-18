import { isAppBasePath } from './app-base-url';
import { PLAYGROUND_QUERY_KEYS } from './router';

export function getBrowserPathAsLandingPage(
	location: Pick<Location, 'pathname' | 'search'> = window.location
): string | undefined {
	if (isAppBasePath(location.pathname)) {
		const searchParams = new URLSearchParams(location.search);
		for (const key of PLAYGROUND_QUERY_KEYS) {
			searchParams.delete(key);
		}
		const search = searchParams.toString();
		return search ? `/?${search}` : undefined;
	}
	return location.pathname + location.search;
}
