import { wordPressSiteUrl } from './config';
import type { AbilitiesList, AbilityInput, AbilityResult } from './abilities';
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

export interface WebMCPFrameBridge {
	listAbilities(): Promise<AbilitiesList>;
	executeAbility(name: string, input?: AbilityInput): Promise<AbilityResult>;
	subscribe(listener: (tools: WebMCPToolDescriptor[]) => void): void;
	/** Use a fresh call ID for each invocation; pending duplicates are rejected. */
	callTool(
		name: string,
		args: Record<string, unknown>,
		callId?: string
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
	wpFrame: HTMLIFrameElement
): WebMCPFrameBridge {
	let tools: WebMCPToolDescriptor[] = [];
	let documentId: string | undefined;
	let serializedTools = '[]';
	let probeTimeout: ReturnType<typeof setTimeout> | null = null;
	const listeners = new Set<(tools: WebMCPToolDescriptor[]) => void>();
	const pendingCalls = new Map<
		string,
		{
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
		}
	>();

	window.addEventListener('message', (event: MessageEvent) => {
		if (
			event.source !== wpFrame.contentWindow ||
			event.origin !== wordPressSiteUrl ||
			!event.data
		) {
			return;
		}
		if (event.data.type === TOOLS_CHANGED) {
			if (
				typeof event.data.documentId === 'string' &&
				documentId !== event.data.documentId
			) {
				rejectPendingCalls();
				documentId = event.data.documentId;
			}
			cancelProbe();
			setTools(toDescriptors(event.data.tools));
			return;
		}
		if (event.data.type === CALL_RESULT) {
			resolveCall(event.data);
		}
	});

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
	wpFrame.addEventListener('load', () => {
		requestToolList();
		cancelProbe();
		probeTimeout = setTimeout(() => {
			probeTimeout = null;
			documentId = undefined;
			rejectPendingCalls();
			setTools([]);
		}, ANNOUNCE_PROBE_TIMEOUT_MS);
	});

	function rejectPendingCalls() {
		for (const pending of pendingCalls.values()) {
			clearTimeout(pending.timeout);
			pending.reject(
				new Error(
					'WordPress navigated. Refresh and try again. The operation may have completed.'
				)
			);
		}
		pendingCalls.clear();
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
		callId?: unknown;
		error?: unknown;
		resultJson?: unknown;
	}) {
		const callId = typeof data.callId === 'string' ? data.callId : '';
		const pending = pendingCalls.get(callId);
		if (!pending) {
			return;
		}
		pendingCalls.delete(callId);
		clearTimeout(pending.timeout);
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

	/** Ask the rendered WordPress frame to announce its current tool registry. */
	function requestToolList() {
		wpFrame.contentWindow?.postMessage(
			{ type: LIST_TOOLS },
			wordPressSiteUrl
		);
	}

	async function request<T = unknown>(
		type: string,
		name: string,
		args: unknown,
		callId: string = crypto.randomUUID()
	): Promise<T> {
		const contentWindow = wpFrame.contentWindow;
		if (!contentWindow) {
			throw new Error('The WordPress frame is not loaded.');
		}
		if (pendingCalls.has(callId)) {
			throw new Error(
				`A WebMCP tool call with ID "${callId}" is already pending. Use a fresh ID for each invocation.`
			);
		}
		return await new Promise<T>((resolve, reject) => {
			const timeout = setTimeout(() => {
				pendingCalls.delete(callId);
				reject(
					new Error(
						`The WordPress request "${name || 'list abilities'}" did not respond within ` +
							`${CALL_TIMEOUT_MS / 1000} seconds. The operation may have completed.`
					)
				);
			}, CALL_TIMEOUT_MS);
			pendingCalls.set(callId, {
				resolve: (value) => resolve(value as T),
				reject,
				timeout,
			});
			contentWindow.postMessage(
				{ type, callId, name, arguments: args, documentId },
				wordPressSiteUrl
			);
		});
	}

	return {
		subscribe(listener) {
			listeners.add(listener);
			// Replay the current list so a late subscriber is not left
			// waiting for the next registration change.
			notify(listener, tools);
			requestToolList();
		},
		listAbilities: () =>
			request<AbilitiesList>('playground-abilities-list', '', undefined),
		executeAbility: (name, input) =>
			request<AbilityResult>('playground-abilities-execute', name, input),
		callTool: (name, args, callId) =>
			request(CALL_TOOL, name, args ?? {}, callId),
		cancelTool(callId) {
			const pending = pendingCalls.get(callId);
			if (!pending) {
				return;
			}
			pendingCalls.delete(callId);
			clearTimeout(pending.timeout);
			wpFrame.contentWindow?.postMessage(
				{ type: CANCEL_TOOL, callId },
				wordPressSiteUrl
			);
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
