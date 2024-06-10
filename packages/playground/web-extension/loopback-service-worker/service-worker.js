// ../../php-wasm/web-service-worker/src/messaging.ts
function getNextRequestId() {
	return ++lastRequestId;
}
function awaitReply(
	messageTarget,
	requestId,
	timeout = DEFAULT_RESPONSE_TIMEOUT
) {
	return new Promise((resolve, reject) => {
		const responseHandler = (event) => {
			if (
				event.data.type === 'response' &&
				event.data.requestId === requestId
			) {
				messageTarget.removeEventListener('message', responseHandler);
				clearTimeout(failOntimeout);
				resolve(event.data.response);
			}
		};
		const failOntimeout = setTimeout(() => {
			reject(new Error('Request timed out'));
			messageTarget.removeEventListener('message', responseHandler);
		}, timeout);
		messageTarget.addEventListener('message', responseHandler);
	});
}
var DEFAULT_RESPONSE_TIMEOUT = 25000;
var lastRequestId = 0;

// ../../php-wasm/scopes/src/index.ts
function isURLScoped(url) {
	return url.pathname.startsWith(`/scope:`);
}
function getURLScope(url) {
	if (isURLScoped(url)) {
		return url.pathname.split('/')[1].split(':')[1];
	}
	return null;
}
function setURLScope(url, scope) {
	let newUrl = new URL(url);
	if (isURLScoped(newUrl)) {
		if (scope) {
			const parts = newUrl.pathname.split('/');
			parts[1] = `scope:${scope}`;
			newUrl.pathname = parts.join('/');
		} else {
			newUrl = removeURLScope(newUrl);
		}
	} else if (scope) {
		const suffix = newUrl.pathname === '/' ? '' : newUrl.pathname;
		newUrl.pathname = `/scope:${scope}${suffix}`;
	}
	return newUrl;
}
function removeURLScope(url) {
	if (!isURLScoped(url)) {
		return url;
	}
	const newUrl = new URL(url);
	const parts = newUrl.pathname.split('/');
	newUrl.pathname = '/' + parts.slice(2).join('/');
	return newUrl;
}

// ../../php-wasm/web-service-worker/src/initialize-service-worker.ts
async function convertFetchEventToPHPRequest(event, options) {
	const { requireScope = true } = options || {};
	let url = new URL(event.request.url);
	if (requireScope && !isURLScoped(url)) {
		try {
			const referrerUrl = new URL(event.request.referrer);
			url = setURLScope(url, getURLScope(referrerUrl));
		} catch (e) {}
	}
	const contentType = event.request.headers.get('content-type');
	const body =
		event.request.method === 'POST'
			? new Uint8Array(await event.request.clone().arrayBuffer())
			: undefined;
	const requestHeaders = {};
	for (const pair of event.request.headers.entries()) {
		requestHeaders[pair[0]] = pair[1];
	}
	let phpResponse;
	try {
		const message = {
			method: 'request',
			args: [
				{
					body,
					url: url.toString(),
					method: event.request.method,
					headers: {
						...requestHeaders,
						Host: url.host,
						'User-agent': self.navigator.userAgent,
						'Content-type': contentType,
					},
				},
			],
		};
		const scope = getURLScope(url);
		if (requireScope && scope === null) {
			throw new Error(
				`The URL ${url.toString()} is not scoped. This should not happen.`
			);
		}
		const requestId = await broadcastMessageExpectReply(message, scope);
		phpResponse = await awaitReply(self, requestId);
		delete phpResponse.headers['x-frame-options'];
	} catch (e) {
		console.error(e, { url: url.toString() });
		throw e;
	}
	return new Response(phpResponse.bytes, {
		headers: phpResponse.headers,
		status: phpResponse.httpStatusCode,
	});
}
async function broadcastMessageExpectReply(message, scope) {
	const requestId = getNextRequestId();
	for (const client of await self.clients.matchAll({
		includeUncontrolled: true,
	})) {
		client.postMessage({
			...message,
			scope,
			requestId,
		});
	}
	return requestId;
}
// loopback-service-worker/service-worker.ts
var reservedFiles = [
	'/register',
	'/register.html',
	'/index',
	'/index.js',
	'/service-worker.js',
	'/service-worker',
];
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (reservedFiles.includes(url.pathname)) {
		return;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return;
	}
	event.preventDefault();
	if (url.pathname === '/test.html') {
		return event.respondWith(
			new Response('Service Worker is working!', {
				headers: {
					'Content-Type': 'text/html',
					'Access-Control-Allow-Origin': '*',
				},
			})
		);
	}
	event.respondWith(
		convertFetchEventToPHPRequest(event, {
			requireScope: false,
		})
	);
});
