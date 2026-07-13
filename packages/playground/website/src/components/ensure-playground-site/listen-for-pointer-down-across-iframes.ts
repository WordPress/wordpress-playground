/**
 * Listens for pointer presses in the host document and every same-origin iframe.
 *
 * Events inside WordPress do not bubble through Playground's nested iframes, so
 * document-level outside-click behavior must subscribe at every document layer.
 */
export function listenForPointerDownAcrossIframes(
	listener: (event: PointerEvent) => void
): () => void {
	const documents = new Set<Document>();
	const frameLoadListeners = new Map<HTMLIFrameElement, () => void>();
	const observers = new Set<MutationObserver>();

	const listenInDocument = (targetDocument: Document) => {
		if (documents.has(targetDocument)) {
			return;
		}
		documents.add(targetDocument);
		targetDocument.addEventListener('pointerdown', listener, true);

		const listenInFrames = () => {
			targetDocument.querySelectorAll('iframe').forEach(listenInFrame);
		};
		listenInFrames();
		const observer = new MutationObserver(listenInFrames);
		observer.observe(targetDocument.documentElement, {
			childList: true,
			subtree: true,
		});
		observers.add(observer);
	};

	const listenInFrame = (frame: HTMLIFrameElement) => {
		if (frameLoadListeners.has(frame)) {
			return;
		}
		const listenAfterLoad = () => {
			try {
				if (frame.contentDocument) {
					listenInDocument(frame.contentDocument);
				}
			} catch {
				// Embedded consumers may point Playground at a cross-origin remote.
			}
		};
		frameLoadListeners.set(frame, listenAfterLoad);
		frame.addEventListener('load', listenAfterLoad);
		listenAfterLoad();
	};

	listenInDocument(document);

	return () => {
		documents.forEach((targetDocument) =>
			targetDocument.removeEventListener('pointerdown', listener, true)
		);
		frameLoadListeners.forEach((loadListener, frame) =>
			frame.removeEventListener('load', loadListener)
		);
		observers.forEach((observer) => observer.disconnect());
	};
}
