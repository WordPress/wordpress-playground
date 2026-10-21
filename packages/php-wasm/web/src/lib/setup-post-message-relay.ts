/**
 * Setup a postMessage relay between the parent window and a nested iframe.
 *
 * When we're running a Playground instance inside an iframe, sometimes that
 * iframe will contain another iframe and so on. The parent application,
 * however, needs to be able to communicate with the innermost iframe. This
 * function relays the communication both ways. Call it in in every iframe
 * layer between the topmost window and the innermost iframe.
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
