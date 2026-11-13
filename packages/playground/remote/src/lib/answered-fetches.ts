/// <reference lib="WebWorker" />

const answered = new WeakSet<FetchEvent>();

/**
 * Record which fetch events an earlier listener answered.
 *
 * The single-origin compatibility worker runs the WordPress and app handlers on
 * the same registration. Calling respondWith() twice throws, and a later handler
 * would also start a redundant network request before it failed.
 */
export function trackAnsweredFetches(event: FetchEvent) {
	const respondWith = event.respondWith.bind(event);
	event.respondWith = (response) => {
		answered.add(event);
		respondWith(response);
	};
}

export function isFetchAnswered(event: FetchEvent) {
	return answered.has(event);
}
