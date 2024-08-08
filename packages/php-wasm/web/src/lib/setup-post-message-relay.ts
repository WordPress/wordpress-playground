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
 * @param expectedOrigin The origin that the nested iframe is expected to be on. If not
 *                       provided, any origin is allowed.
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

		if (typeof event.data !== 'object' || event.data.type !== 'relay') {
			return;
		}

		window.parent.postMessage(event.data, '*');
	});

	// Relay Messages from Parent to WP
	window.addEventListener('message', (event) => {
		if (event.source !== window.parent) {
			return;
		}

		if (typeof event.data !== 'object' || event.data.type !== 'relay') {
			return;
		}

		nestedFrame?.contentWindow?.postMessage(event.data);
	});
}
