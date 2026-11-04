/**
 * Listen for pointer presses in the host and any iframe documents the browser lets us read.
 *
 * A press inside WordPress cannot bubble into the app. WordPress sends a message to
 * remote.html, which dispatches a new press on its #wp iframe element. Observe that
 * press here and skip the original event in documents marked with an active relay.
 *
 * Keep native listeners for unmarked documents, such as plain HTML or editor frames
 * without a confirmed relay. Still visit children of marked documents: the marker
 * covers only that document's presses. Unreadable frames need their own working relay.
 */
export function listenForPointerDownAcrossIframes(
	listener: (event: PointerEvent) => void
): () => void {
	const documents = new Set<Document>();
	const frameLoadListeners = new Map<HTMLIFrameElement, () => void>();
	const frameDocuments = new Map<HTMLIFrameElement, Document>();
	const observers = new Map<Document, MutationObserver>();

	listenInDocument(document);

	return () => {
		stopListeningInDocument(document);
		Array.from(frameLoadListeners).forEach(([frame]) =>
			stopListeningInFrame(frame)
		);
		Array.from(documents).forEach(stopListeningInDocument);
	};

	function onPointerDown(event: Event) {
		// WordPress adds the marker only after remote.html confirms it can receive presses.
		// Check on each event: that reply may arrive after we attach this listener.
		const targetDocument = event.currentTarget as Document;
		if (
			!targetDocument.documentElement.hasAttribute(
				'data-playground-pointer-relay'
			)
		) {
			listener(event as PointerEvent);
		}
	}

	function listenInDocument(targetDocument: Document) {
		if (documents.has(targetDocument)) {
			return;
		}
		documents.add(targetDocument);
		targetDocument.addEventListener('pointerdown', onPointerDown, true);

		targetDocument.querySelectorAll('iframe').forEach(listenInFrame);
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				record.removedNodes.forEach((node) =>
					visitFrames(node, stopListeningInFrame)
				);
				record.addedNodes.forEach((node) =>
					visitFrames(node, listenInFrame)
				);
			}
		});
		observer.observe(targetDocument.documentElement, {
			childList: true,
			subtree: true,
		});
		observers.set(targetDocument, observer);
	}

	function stopListeningInDocument(targetDocument: Document) {
		if (!documents.delete(targetDocument)) {
			return;
		}
		targetDocument.removeEventListener('pointerdown', onPointerDown, true);
		observers.get(targetDocument)?.disconnect();
		observers.delete(targetDocument);
		targetDocument.querySelectorAll('iframe').forEach(stopListeningInFrame);
	}

	function listenInFrame(frame: HTMLIFrameElement) {
		if (frameLoadListeners.has(frame)) {
			return;
		}
		const listenAfterLoad = () => {
			let nextDocument: Document | null = null;
			try {
				nextDocument = frame.contentDocument;
			} catch {
				// Embedded consumers may point Playground at a cross-origin remote.
			}
			const previousDocument = frameDocuments.get(frame);
			if (previousDocument === nextDocument) {
				return;
			}
			if (previousDocument) {
				stopListeningInDocument(previousDocument);
			}
			if (nextDocument) {
				frameDocuments.set(frame, nextDocument);
				listenInDocument(nextDocument);
			} else {
				frameDocuments.delete(frame);
			}
		};
		frameLoadListeners.set(frame, listenAfterLoad);
		frame.addEventListener('load', listenAfterLoad);
		listenAfterLoad();
	}

	function stopListeningInFrame(frame: HTMLIFrameElement) {
		const loadListener = frameLoadListeners.get(frame);
		if (!loadListener) {
			return;
		}
		frame.removeEventListener('load', loadListener);
		frameLoadListeners.delete(frame);
		const frameDocument = frameDocuments.get(frame);
		frameDocuments.delete(frame);
		if (frameDocument) {
			stopListeningInDocument(frameDocument);
		}
	}

	function visitFrames(
		node: Node,
		visit: (frame: HTMLIFrameElement) => void
	) {
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return;
		}
		const element = node as Element;
		if (element.matches('iframe')) {
			visit(element as HTMLIFrameElement);
		}
		element.querySelectorAll('iframe').forEach(visit);
	}
}
