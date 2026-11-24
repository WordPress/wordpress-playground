/**
 * Forward messages marked type: 'relay' between the parent window and a child iframe.
 *
 * For example, in app -> remote.html -> WordPress, remote.html calls this with the
 * WordPress iframe. A message from either adjacent window is forwarded to the other;
 * messages from unrelated windows are ignored. Call this in each intermediate layer
 * when there are more nested frames.
 *
 * expectedOrigin applies to the child: it filters replies and targets requests, so
 * the child may be cross-origin. The parent may be an external embedder; its window
 * is checked, but its origin is not restricted here.
 *
 * @param nestedFrame The nested iframe element
 * @param expectedOrigin The nested iframe's origin, used to filter incoming messages
 *                       and target outgoing ones. If omitted, incoming messages may
 *                       use any origin, but outgoing messages stay same-origin.
 */
export function setupPostMessageRelay(
	nestedFrame: HTMLIFrameElement,
	expectedOrigin?: string
) {
	// Relay Messages from WP to Parent
	window.addEventListener('message', (event) => {
		if (event.source !== nestedFrame.contentWindow) {
			return;
		}

		if (expectedOrigin && event.origin !== expectedOrigin) {
			return;
		}

		if (
			event.data === null ||
			typeof event.data !== 'object' ||
			event.data.type !== 'relay'
		) {
			return;
		}

		window.parent.postMessage(event.data, '*');
	});

	// Relay Messages from Parent to WP
	window.addEventListener('message', (event) => {
		if (event.source !== window.parent) {
			return;
		}

		if (
			event.data === null ||
			typeof event.data !== 'object' ||
			event.data.type !== 'relay'
		) {
			return;
		}

		// The default target only reaches same-origin windows; WordPress may be cross-origin.
		nestedFrame?.contentWindow?.postMessage(
			event.data,
			expectedOrigin ?? '/'
		);
	});
}
