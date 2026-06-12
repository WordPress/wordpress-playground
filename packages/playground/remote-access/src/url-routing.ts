export interface RemoteAccessRouteOptions {
	connectPath?: string;
	shareParam?: string;
	scope?: string;
	relayViewParam?: string;
}

const DEFAULT_CONNECT_PATH = '/connect';
const DEFAULT_SHARE_PARAM = 'share';
const DEFAULT_SCOPE = 'default';
const DEFAULT_RELAY_VIEW_PARAM = 'remote-access-view';

export function getRemoteAccessSessionId(
	url: string,
	{ shareParam = DEFAULT_SHARE_PARAM }: RemoteAccessRouteOptions = {}
): string | null {
	return new URL(url).searchParams.get(shareParam);
}

export function stripRemoteAccessSessionId(
	url: string,
	{
		connectPath = DEFAULT_CONNECT_PATH,
		shareParam = DEFAULT_SHARE_PARAM,
	}: RemoteAccessRouteOptions = {}
): string {
	const nextUrl = new URL(url);
	nextUrl.searchParams.delete(shareParam);
	const pathAndSearch = `${nextUrl.pathname}${nextUrl.search}`;
	return pathAndSearch || connectPath;
}

export function getRemoteAccessPathFromConnectUrl(
	url: string,
	{
		connectPath = DEFAULT_CONNECT_PATH,
		shareParam = DEFAULT_SHARE_PARAM,
	}: RemoteAccessRouteOptions = {}
): string {
	const nextUrl = new URL(url);
	if (!nextUrl.pathname.startsWith(connectPath)) {
		return '/';
	}
	const path = nextUrl.pathname.slice(connectPath.length) || '/';
	nextUrl.searchParams.delete(shareParam);
	return `${path}${nextUrl.search}`;
}

export function buildRemoteAccessScopedIframeUrl(
	pathAndSearch: string,
	sessionId: string,
	{
		scope = DEFAULT_SCOPE,
		relayViewParam = DEFAULT_RELAY_VIEW_PARAM,
	}: RemoteAccessRouteOptions = {}
): string {
	const scopedBase = `/scope:${scope}/`;
	const url = new URL(
		normalizeRemoteAccessPath(pathAndSearch),
		window.location.origin
	);
	const scopedUrl = new URL(
		`${scopedBase.replace(/\/$/, '')}${url.pathname}${url.search}`,
		window.location.origin
	);
	scopedUrl.searchParams.set(relayViewParam, sessionId);
	return `${scopedUrl.pathname}${scopedUrl.search}`;
}

export function buildConnectUrlFromScopedIframeUrl(
	iframeUrl: string,
	currentUrl: string,
	{
		connectPath = DEFAULT_CONNECT_PATH,
		scope = DEFAULT_SCOPE,
		relayViewParam = DEFAULT_RELAY_VIEW_PARAM,
	}: RemoteAccessRouteOptions = {}
): string | null {
	const parsedIframeUrl = new URL(iframeUrl);
	const scopedPrefix = `/scope:${scope}`;
	if (!parsedIframeUrl.pathname.startsWith(scopedPrefix)) {
		return null;
	}
	const unscopedPath =
		parsedIframeUrl.pathname.slice(scopedPrefix.length) || '/';
	parsedIframeUrl.searchParams.delete(relayViewParam);
	const nextUrl = new URL(currentUrl);
	nextUrl.pathname = `${connectPath}${unscopedPath}`;
	nextUrl.search = parsedIframeUrl.search;
	nextUrl.hash = '';
	return nextUrl.href;
}

export function normalizeRemoteAccessPath(pathAndSearch: string): string {
	const normalized = pathAndSearch.startsWith('/')
		? pathAndSearch
		: `/${pathAndSearch}`;
	return normalized || '/';
}
