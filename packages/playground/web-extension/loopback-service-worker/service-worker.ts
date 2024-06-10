/// <reference lib="WebWorker" />

import { convertFetchEventToPHPRequest } from '@php-wasm/web-service-worker';

const reservedFiles = [
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

	// Filter out requests to extensions assets.
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
