
export const DEFAULT_BASE_URL = 'http://example.com';

export function getPathQueryFragment(url) {
	return url.toString().substring(url.origin.length);
}

export function isURLScoped(url) {
	return url.pathname.startsWith(`/scope:`);
}

export function getURLScope(url) {
	if (isURLScoped(url)) {
		return url.pathname.split('/')[1].split(':')[1];
	}
	return null;
}

export function setURLScope(url, scope) {
	if (!scope) {
		return url;
	}
	const newUrl = new URL(url);

	if (isURLScoped(newUrl)) {
		const parts = newUrl.pathname.split('/');
		parts[1] = `scope:${scope}`;
		newUrl.pathname = parts.join('/');
	} else {
		const suffix = newUrl.pathname === '/' ? '' : newUrl.pathname;
		newUrl.pathname = `/scope:${scope}${suffix}`;
	}

	return newUrl;
}
export function removeURLScope(url) {
	if (!isURLScoped(url)) {
		return url;
	}
	const newUrl = new URL(url);
	const parts = newUrl.pathname.split('/');
	newUrl.pathname = '/' + parts.slice(2).join('/');
	return newUrl;
}
