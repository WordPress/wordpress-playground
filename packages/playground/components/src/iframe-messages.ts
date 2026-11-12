export function isMessageFromIframeTree(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
): boolean {
	if (!iframe?.contentWindow || !event.source) {
		return false;
	}
	if (event.source === iframe.contentWindow) {
		return true;
	}
	return isDescendantWindow(iframe.contentWindow, event.source);
}

function isDescendantWindow(
	root: Window,
	candidate: MessageEventSource
): boolean {
	try {
		for (let i = 0; i < root.frames.length; i++) {
			const child = root.frames[i];
			if (child === candidate || isDescendantWindow(child, candidate)) {
				return true;
			}
		}
	} catch {
		// Cross-origin frames are not inspectable and therefore not accepted.
	}
	return false;
}
