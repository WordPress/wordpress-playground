import { wordPressSiteUrl } from './config';
import { logger } from '@php-wasm/logger';

/**
 * Message types exchanged with the WebMCP registry running inside the
 * WordPress document.
 *
 * @see packages/playground/remote/src/lib/playground-mu-plugin/0-playground.php
 */
const TOOLS_CHANGED = 'playground-webmcp-tools-changed';
const LIST_TOOLS = 'playground-webmcp-list-tools';
const CALL_TOOL = 'playground-webmcp-call-tool';
const CALL_RESULT = 'playground-webmcp-call-result';
const CANCEL_TOOL = 'playground-webmcp-cancel-tool';
const DOCUMENT_HIDDEN = 'playground-webmcp-document-hidden';
const INTERACTION_REQUEST = 'playground-webmcp-interaction-request';
const INTERACTION_RUN = 'playground-webmcp-interaction-run';
const INTERACTION_DENIED = 'playground-webmcp-interaction-denied';
const INTERACTION_RESULT = 'playground-webmcp-interaction-result';

const CALL_TIMEOUT_MS = 60000;

/**
 * How long a freshly loaded document has to claim the advertised tools before
 * they are dropped. Long enough for a busy document, short enough that an
 * agent does not act on a list the visible page no longer backs.
 */
const ANNOUNCE_PROBE_TIMEOUT_MS = 1000;

/**
 * A tool a plugin registered with `document.modelContext` inside the
 * WordPress document, as seen from outside that document.
 *
 * `execute` does not survive the frame boundary, so only the descriptive
 * fields are carried over. Calls travel back through `callWebMCPTool()`.
 */
export interface WebMCPToolDescriptor {
	name: string;
	description: string;
	inputSchema?: Record<string, unknown>;
	annotations?: {
		readOnlyHint?: boolean;
		destructiveHint?: boolean;
		consequentialHint?: boolean;
		untrustedContentHint?: boolean;
		debugging?: boolean;
	};
}

/**
 * Handles a site tool's `requestUserInteraction()` for one call.
 *
 * `runInSite` runs the site's callback inside the WordPress document and
 * resolves with its result. The handler decides whether and when to call it,
 * typically after handing control to the user. A rejection refuses the
 * interaction.
 */
export type WebMCPUserInteractionHandler = (
	runInSite: () => Promise<unknown>
) => Promise<unknown>;

export interface WebMCPFrameBridge {
	subscribe(listener: (tools: WebMCPToolDescriptor[]) => void): () => void;
	dispose(): void;
	/**
	 * Use a fresh call ID for each invocation; pending duplicates are rejected.
	 * Without `onUserInteraction`, the tool's interaction requests are refused.
	 */
	callTool(
		name: string,
		args: Record<string, unknown>,
		callId?: string,
		onUserInteraction?: WebMCPUserInteractionHandler
	): Promise<unknown>;
	cancelTool(callId: string): void;
}

/**
 * Mirrors the WordPress document's WebMCP tools into this frame and forwards
 * tool calls back into it.
 *
 * The WordPress document owns the registry because the remote frame cannot
 * read its DOM under Document-Isolation-Policy. Each announcement carries the
 * full tool list and replaces the previous one, so a navigation that registers
 * no tools clears the list.
 */
export function createWebMCPFrameBridge(
	wpFrame: HTMLIFrameElement,
	options: { origin?: string; relayMessages?: boolean } = {}
): WebMCPFrameBridge {
	const origin = options.origin ?? wordPressSiteUrl;
	let disposed = false;
	let tools: WebMCPToolDescriptor[] = [];
	let serializedTools = '[]';
	let documentId: string | undefined;
	let probeTimeout: ReturnType<typeof setTimeout> | null = null;
	const listeners = new Set<(tools: WebMCPToolDescriptor[]) => void>();
	const pendingCalls = new Map<
		string,
		{
			documentId: string | undefined;
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
			onUserInteraction?: WebMCPUserInteractionHandler;
		}
	>();
	/** Interaction IDs whose request is being handled, to refuse duplicates. */
	const requestedInteractions = new Set<string>();
	const pendingInteractions = new Map<
		string,
		{
			callId: string;
			documentId: string | undefined;
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
		}
	>();

	function handleMessage(event: MessageEvent) {
		if (
			event.source !== wpFrame.contentWindow ||
			event.origin !== origin ||
			!event.data
		) {
			return;
		}
		if (
			options.relayMessages &&
			event.data.type === 'remote-access-frame-load'
		) {
			handleLoad();
			return;
		}
		const data = options.relayMessages
			? event.data.type === 'remote-access-frame-message' &&
				event.data.payload
			: event.data;
		if (!data) return;
		if (
			data.type === DOCUMENT_HIDDEN &&
			typeof data.documentId === 'string'
		) {
			rejectDocumentCalls(data.documentId);
			if (data.documentId === documentId) {
				documentId = undefined;
				setTools([]);
			}
			return;
		}
		if (data.type === TOOLS_CHANGED) {
			const nextDocumentId =
				typeof data.documentId === 'string'
					? data.documentId
					: undefined;
			if (nextDocumentId !== documentId) {
				rejectDocumentCalls(documentId);
				documentId = nextDocumentId;
			}
			cancelProbe();
			setTools(toDescriptors(data.tools));
			return;
		}
		if (data.type === CALL_RESULT) {
			resolveCall(data);
			return;
		}
		if (data.type === INTERACTION_REQUEST) {
			handleInteractionRequest(data);
			return;
		}
		if (data.type === INTERACTION_RESULT) {
			resolveInteraction(data);
		}
	}
	window.addEventListener('message', handleMessage);

	/**
	 * Confirms that the newly loaded document still owns the advertised tools.
	 *
	 * A WordPress document announces its tools while its head is parsed, so by
	 * now the list is usually already correct. Documents Playground does not
	 * inject the registry into – `admin-ajax.php`, a REST route, a static file,
	 * a PDF – announce nothing at all, and without this the previous page's
	 * tools would stay advertised and fail when called. They cannot answer the
	 * probe either, so the list is dropped when the answer does not arrive.
	 *
	 * A document merely too busy to answer in time is cleared and restored by
	 * its own reply moments later.
	 */
	function handleLoad() {
		requestToolList();
		cancelProbe();
		probeTimeout = setTimeout(() => {
			probeTimeout = null;
			setTools([]);
		}, ANNOUNCE_PROBE_TIMEOUT_MS);
	}
	wpFrame.addEventListener('load', handleLoad);

	/** Reject only calls owned by the document that left, never its replacement. */
	function rejectDocumentCalls(departedDocumentId: string | undefined) {
		for (const [callId, pending] of pendingCalls) {
			if (pending.documentId !== departedDocumentId) {
				continue;
			}
			pendingCalls.delete(callId);
			clearTimeout(pending.timeout);
			rejectCallInteractions(callId);
			pending.reject(
				new Error(
					'The WordPress page changed before the WebMCP tool responded. ' +
						'The operation may have completed; check before retrying.'
				)
			);
		}
	}

	function setTools(next: WebMCPToolDescriptor[]) {
		const serialized = JSON.stringify(next);
		if (serialized === serializedTools) {
			return;
		}
		serializedTools = serialized;
		tools = next;
		for (const listener of listeners) {
			notify(listener, tools);
		}
	}

	function cancelProbe() {
		if (probeTimeout) {
			clearTimeout(probeTimeout);
			probeTimeout = null;
		}
	}

	function resolveCall(data: {
		documentId?: unknown;
		callId?: unknown;
		error?: unknown;
		resultJson?: unknown;
	}) {
		const callId = typeof data.callId === 'string' ? data.callId : '';
		const pending = pendingCalls.get(callId);
		if (
			!pending ||
			(pending.documentId && data.documentId !== pending.documentId)
		) {
			return;
		}
		pendingCalls.delete(callId);
		clearTimeout(pending.timeout);
		rejectCallInteractions(callId);
		if (typeof data.error === 'string') {
			pending.reject(new Error(data.error));
			return;
		}
		try {
			pending.resolve(
				typeof data.resultJson === 'string'
					? JSON.parse(data.resultJson)
					: null
			);
		} catch {
			pending.reject(
				new Error('The WebMCP tool returned an unparsable result.')
			);
		}
	}

	/**
	 * Relays a site tool's interaction request to the handler its caller supplied.
	 * Requests that no pending call of this document can claim are refused.
	 */
	function handleInteractionRequest(data: {
		documentId?: unknown;
		callId?: unknown;
		interactionId?: unknown;
	}) {
		if (typeof data.interactionId !== 'string' || !data.interactionId) {
			return;
		}
		const interactionId = data.interactionId;
		const requestDocumentId =
			typeof data.documentId === 'string' ? data.documentId : undefined;
		const callId = typeof data.callId === 'string' ? data.callId : '';
		const pending = pendingCalls.get(callId);
		const deny = (reason: string) =>
			postMessage({
				type: INTERACTION_DENIED,
				documentId: requestDocumentId,
				interactionId,
				error: reason,
			});
		if (
			!pending ||
			pending.documentId !== requestDocumentId ||
			!pending.onUserInteraction ||
			requestedInteractions.has(interactionId)
		) {
			deny('User interaction is not available for this tool call.');
			return;
		}
		requestedInteractions.add(interactionId);
		let started = false;
		const runInSite = () =>
			new Promise<unknown>((resolve, reject) => {
				if (started) {
					reject(new Error('The interaction has already run.'));
					return;
				}
				started = true;
				if (!pendingCalls.has(callId)) {
					reject(new Error('The tool call has already ended.'));
					return;
				}
				pendingInteractions.set(interactionId, {
					callId,
					documentId: requestDocumentId,
					resolve,
					reject,
				});
				postMessage({
					type: INTERACTION_RUN,
					documentId: requestDocumentId,
					interactionId,
				});
			});
		// Once the callback runs, the WordPress document settles it. A handler
		// that finishes without running it refuses the interaction.
		Promise.resolve()
			.then(() => pending.onUserInteraction!(runInSite))
			.then(
				() => {
					if (!started) {
						deny('The user interaction was not started.');
					}
				},
				(error: unknown) => {
					if (!started) {
						deny(
							error instanceof Error && error.message
								? error.message
								: 'The user interaction was refused.'
						);
					}
				}
			)
			.finally(() => requestedInteractions.delete(interactionId));
	}

	function resolveInteraction(data: {
		documentId?: unknown;
		interactionId?: unknown;
		error?: unknown;
		resultJson?: unknown;
	}) {
		const interactionId =
			typeof data.interactionId === 'string' ? data.interactionId : '';
		const pending = pendingInteractions.get(interactionId);
		if (!pending || data.documentId !== pending.documentId) {
			return;
		}
		pendingInteractions.delete(interactionId);
		if (typeof data.error === 'string') {
			pending.reject(new Error(data.error));
			return;
		}
		try {
			pending.resolve(
				typeof data.resultJson === 'string'
					? JSON.parse(data.resultJson)
					: null
			);
		} catch {
			pending.reject(
				new Error('The interaction returned an unparsable result.')
			);
		}
	}

	function rejectCallInteractions(callId: string) {
		for (const [interactionId, pending] of pendingInteractions) {
			if (pending.callId !== callId) {
				continue;
			}
			pendingInteractions.delete(interactionId);
			pending.reject(new Error('The tool call has ended.'));
		}
	}

	/** Ask the rendered WordPress frame to announce its current tool registry. */
	function requestToolList() {
		postMessage({ type: LIST_TOOLS });
	}

	function postMessage(data: unknown) {
		wpFrame.contentWindow?.postMessage(
			options.relayMessages
				? { type: 'remote-access-frame-forward', payload: data }
				: data,
			origin
		);
	}

	return {
		dispose() {
			disposed = true;
			window.removeEventListener('message', handleMessage);
			wpFrame.removeEventListener('load', handleLoad);
			cancelProbe();
			for (const callId of pendingCalls.keys()) {
				this.cancelTool(callId);
			}
			listeners.clear();
		},
		subscribe(listener) {
			listeners.add(listener);
			// Replay the current list so a late subscriber is not left
			// waiting for the next registration change.
			notify(listener, tools);
			requestToolList();
			return () => {
				listeners.delete(listener);
			};
		},
		/** Dispatch a tool call only to the rendered WordPress origin and bound its response time. */
		async callTool(
			name,
			args,
			callId = crypto.randomUUID(),
			onUserInteraction
		) {
			const contentWindow = wpFrame.contentWindow;
			if (disposed || !contentWindow) {
				throw new Error('The WordPress frame is not loaded.');
			}
			if (pendingCalls.has(callId)) {
				throw new Error(
					`A WebMCP tool call with ID "${callId}" is already pending. ` +
						'Use a fresh ID for each invocation.'
				);
			}
			return await new Promise<unknown>((resolve, reject) => {
				const timeout = setTimeout(() => {
					pendingCalls.delete(callId);
					rejectCallInteractions(callId);
					reject(
						new Error(
							`The WebMCP tool "${name}" did not respond within ` +
								`${CALL_TIMEOUT_MS / 1000} seconds.`
						)
					);
				}, CALL_TIMEOUT_MS);
				pendingCalls.set(callId, {
					documentId,
					resolve,
					reject,
					timeout,
					onUserInteraction,
				});
				postMessage({
					type: CALL_TOOL,
					callId,
					...(documentId ? { documentId } : {}),
					name,
					arguments: args ?? {},
				});
			});
		},
		cancelTool(callId) {
			const pending = pendingCalls.get(callId);
			if (!pending) {
				return;
			}
			pendingCalls.delete(callId);
			clearTimeout(pending.timeout);
			rejectCallInteractions(callId);
			postMessage({
				type: CANCEL_TOOL,
				callId,
				...(pending.documentId
					? { documentId: pending.documentId }
					: {}),
			});
			pending.reject(
				new DOMException('The tool call was cancelled.', 'AbortError')
			);
		},
	};
}

function notify(
	listener: (tools: WebMCPToolDescriptor[]) => void,
	tools: WebMCPToolDescriptor[]
) {
	try {
		// The listener is a Comlink proxy in the common case, so it returns a
		// promise this frame has no way to act on.
		void Promise.resolve(listener(tools)).catch(onNotifyError);
	} catch (error) {
		onNotifyError(error);
	}
}

function onNotifyError(error: unknown) {
	logger.warn('Failed to deliver WebMCP tool changes:', error);
}

function toDescriptors(value: unknown): WebMCPToolDescriptor[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const descriptors: WebMCPToolDescriptor[] = [];
	for (const tool of value) {
		if (!tool || typeof tool.name !== 'string' || !tool.name) {
			continue;
		}
		descriptors.push({
			name: tool.name,
			description:
				typeof tool.description === 'string' ? tool.description : '',
			inputSchema: isPlainObject(tool.inputSchema)
				? tool.inputSchema
				: undefined,
			annotations: isPlainObject(tool.annotations)
				? tool.annotations
				: undefined,
		});
	}
	return descriptors;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
