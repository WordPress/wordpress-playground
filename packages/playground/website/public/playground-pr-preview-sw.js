/* eslint-disable no-restricted-globals */
/* global importScripts */
const playgroundPrParam = 'playground-pr';
const playgroundPrShaParam = 'playground-pr-sha';
const previewPathPrefix = '/pr-previews/';

const preview = getPreviewFromLocation();
const previewClientIds = new Set();
const importedFetchListeners = [];
const nativeAddEventListener = self.addEventListener.bind(self);

self.addEventListener = function (type, listener, options) {
	if (type === 'fetch') {
		importedFetchListeners.push({ listener, options });
		return;
	}
	return nativeAddEventListener(type, listener, options);
};

try {
	if (preview) {
		importScripts(getPreviewUrl('/sw.js').toString());
	}
} finally {
	self.addEventListener = nativeAddEventListener;
}

nativeAddEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	const mappedUrl = getEffectivePreviewUrl(event, url);
	if (mappedUrl) {
		event.respondWith(fetchWithUrl(event.request, mappedUrl));
		return;
	}

	for (const { listener } of importedFetchListeners) {
		if (typeof listener === 'function') {
			listener.call(self, event);
		} else if (listener && typeof listener.handleEvent === 'function') {
			listener.handleEvent(event);
		}
	}
});

function getPreviewFromLocation() {
	const url = new URL(self.location.href);
	const pr = url.searchParams.get(playgroundPrParam);
	const sha = url.searchParams.get(playgroundPrShaParam);
	if (!/^\d+$/.test(pr || '') || !/^[a-f0-9]{7,40}$/i.test(sha || '')) {
		return undefined;
	}
	return { pr, sha };
}

function getEffectivePreviewUrl(event, url) {
	if (!preview || url.origin !== self.location.origin) {
		return undefined;
	}

	if (url.pathname.startsWith(previewPathPrefix)) {
		return undefined;
	}

	if (isPreviewNavigationRequest(event.request)) {
		const clientId = event.resultingClientId || event.clientId;
		if (isPlaygroundPrPreviewUrl(url)) {
			if (clientId) {
				previewClientIds.add(clientId);
			}
			return shouldMapToPreview(url)
				? getPreviewUrl(url.pathname)
				: undefined;
		}

		if (clientId) {
			previewClientIds.delete(clientId);
		}
		return undefined;
	}

	let referrerUrl;
	try {
		referrerUrl = new URL(event.request.referrer);
	} catch {
		// Ignore missing or invalid referrers.
	}

	const isPreviewClient =
		!!event.clientId && previewClientIds.has(event.clientId);
	const hasPreviewReferrer =
		!!referrerUrl && isPlaygroundPrPreviewUrl(referrerUrl);
	if (!isPreviewClient && !hasPreviewReferrer) {
		return undefined;
	}

	return shouldMapToPreview(url) ? getPreviewUrl(url.pathname) : undefined;
}

function isPreviewNavigationRequest(request) {
	return request.mode === 'navigate';
}

function isPlaygroundPrPreviewUrl(url) {
	return (
		url.searchParams.get(playgroundPrParam) === preview?.pr &&
		url.searchParams.get(playgroundPrShaParam) === preview?.sha
	);
}

function shouldMapToPreview(url) {
	const { pathname } = url;
	return !(
		pathname.startsWith(previewPathPrefix) ||
		pathname.startsWith('/scope:') ||
		pathname.startsWith('/plugin-proxy') ||
		pathname.startsWith('/client/index.js') ||
		pathname.startsWith('/proxy/') ||
		pathname.endsWith('.php')
	);
}

function getPreviewUrl(pathname) {
	const url = new URL(self.location.origin);
	const pathWithoutLeadingSlash = pathname.replace(/^\//, '');
	url.pathname = `${previewPathPrefix}${preview.pr}/${preview.sha}/${pathWithoutLeadingSlash}`;
	return url;
}

async function fetchWithUrl(request, url) {
	const requestWithUrl = await cloneRequestWithUrl(request, url);
	return fetch(requestWithUrl, { cache: 'no-store' });
}

async function cloneRequestWithUrl(request, url) {
	let body;
	if (!['GET', 'HEAD'].includes(request.method)) {
		body = await request.clone().arrayBuffer();
	}

	return new Request(url, {
		body,
		method: request.method,
		headers: request.headers,
		referrer: request.referrer,
		referrerPolicy: request.referrerPolicy,
		mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
		credentials: request.credentials,
		cache: 'no-store',
		redirect: request.redirect,
		integrity: request.integrity,
	});
}
