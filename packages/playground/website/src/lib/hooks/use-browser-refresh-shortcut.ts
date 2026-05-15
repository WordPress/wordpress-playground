import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { PlaygroundClient } from '@wp-playground/remote';
import { logger } from '@php-wasm/logger';

const PLAYGROUND_REFRESH_RELAY_TYPE = 'playground-refresh';

export function useBrowserRefreshShortcut({
	client,
	enabled = true,
	iframeRef,
}: {
	client?: PlaygroundClient;
	enabled?: boolean;
	iframeRef: RefObject<HTMLIFrameElement>;
}) {
	useEffect(() => {
		if (!enabled || !client) {
			return;
		}
		const playground = client;

		function handleKeyDown(event: KeyboardEvent) {
			if (!isBrowserRefreshShortcut(event)) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			void reloadPlaygroundClient(playground).catch((error) =>
				logger.error(error)
			);
		}

		window.addEventListener('keydown', handleKeyDown, true);
		return () => {
			window.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [client, enabled]);

	useEffect(() => {
		if (!enabled || !client) {
			return;
		}
		const playground = client;

		function handleMessage(event: MessageEvent) {
			if (
				event.origin !== window.location.origin ||
				!isPlaygroundRefreshMessage(event.data) ||
				!isMessageFromIframeTree(event, iframeRef.current)
			) {
				return;
			}

			void reloadPlaygroundClient(playground).catch((error) =>
				logger.error(error)
			);
		}

		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	}, [client, enabled, iframeRef]);
}

async function reloadPlaygroundClient(client: PlaygroundClient) {
	await client.goTo(await client.getCurrentURL());
}

export function isBrowserRefreshShortcut(
	event: Pick<
		KeyboardEvent,
		| 'altKey'
		| 'ctrlKey'
		| 'defaultPrevented'
		| 'isComposing'
		| 'key'
		| 'metaKey'
		| 'repeat'
	>
): boolean {
	return (
		!event.defaultPrevented &&
		!event.altKey &&
		!event.isComposing &&
		!event.repeat &&
		event.key.toLowerCase() === 'r' &&
		(event.metaKey || event.ctrlKey)
	);
}

function isPlaygroundRefreshMessage(data: unknown): boolean {
	return (
		typeof data === 'object' &&
		data !== null &&
		(data as { type?: unknown }).type === 'relay' &&
		(data as { relayType?: unknown }).relayType ===
			PLAYGROUND_REFRESH_RELAY_TYPE
	);
}

function isMessageFromIframeTree(
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
		// Cross-origin descendants are not inspectable and are not accepted.
	}
	return false;
}
