import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebMCPFrameBridge } from './webmcp-frame-bridge';

vi.mock('./config', () => ({ wordPressSiteUrl: 'https://wordpress.test' }));

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('WebMCP frame call IDs', () => {
	// Contract: concurrent calls cannot replace one another's pending response.
	// A caller-supplied ID bypasses randomUUID and could accidentally overwrite
	// the first resolver and timeout when a second invocation reuses that ID.
	it('rejects a pending duplicate and preserves the first response', async () => {
		vi.useFakeTimers();
		let receive!: (event: MessageEvent) => void;
		const postMessage = vi.fn();
		const contentWindow = { postMessage };
		vi.stubGlobal('window', {
			addEventListener: (type: string, listener: typeof receive) => {
				if (type === 'message') receive = listener;
			},
		});
		const frame = {
			contentWindow,
			addEventListener: vi.fn(),
		} as unknown as HTMLIFrameElement;
		const bridge = createWebMCPFrameBridge(frame);
		const first = bridge.callTool('first_tool', {}, 'same-id');
		const duplicate = bridge.callTool('second_tool', {}, 'same-id');

		receive({
			source: contentWindow,
			origin: 'https://wordpress.test',
			data: {
				type: 'playground-webmcp-call-result',
				callId: 'same-id',
				resultJson: JSON.stringify({ from: 'first_tool' }),
			},
		} as unknown as MessageEvent);

		await expect(duplicate).rejects.toThrow('already pending');
		await expect(first).resolves.toEqual({ from: 'first_tool' });
		expect(postMessage).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('WebMCP frame cancellation', () => {
	// Contract: the remote rejects and releases a cancelled call and sends the
	// same ID to WordPress. The independently delivered cancellation message
	// must not affect other calls or leave its timeout running.
	it('forwards cancellation and removes the pending call', async () => {
		vi.useFakeTimers();
		const postMessage = vi.fn();
		vi.stubGlobal('window', {
			location: { origin: 'https://playground.test' },
			addEventListener: vi.fn(),
		});
		const frame = {
			contentWindow: { postMessage },
			addEventListener: vi.fn(),
		} as unknown as HTMLIFrameElement;
		const bridge = createWebMCPFrameBridge(frame);
		const result = bridge.callTool('site_tool', {}, 'call-1');
		bridge.cancelTool('call-1');
		await expect(result).rejects.toMatchObject({ name: 'AbortError' });
		expect(postMessage).toHaveBeenLastCalledWith(
			{ type: 'playground-webmcp-cancel-tool', callId: 'call-1' },
			'https://wordpress.test'
		);
		expect(vi.getTimerCount()).toBe(0);
		postMessage.mockClear();
		bridge.cancelTool('call-1');
		expect(postMessage).not.toHaveBeenCalled();
	});
});

// Contract: a site interaction runs only through the caller-supplied handler for the
// call that requested it. Requests for other calls, calls without a handler, and
// cancelled calls are refused independently of the WordPress document's own state.
describe('WebMCP frame interaction relay', () => {
	it("runs the site callback only through the requesting call's handler", async () => {
		vi.useFakeTimers();
		let receive!: (event: MessageEvent) => void;
		const postMessage = vi.fn();
		const contentWindow = { postMessage };
		vi.stubGlobal('window', {
			addEventListener: (type: string, listener: typeof receive) => {
				if (type === 'message') receive = listener;
			},
		});
		const frame = {
			contentWindow,
			addEventListener: vi.fn(),
		} as unknown as HTMLIFrameElement;
		const bridge = createWebMCPFrameBridge(frame);
		const deliver = (data: Record<string, unknown>) =>
			receive({
				source: contentWindow,
				origin: 'https://wordpress.test',
				data,
			} as unknown as MessageEvent);
		deliver({
			type: 'playground-webmcp-tools-changed',
			documentId: 'doc',
			tools: [{ name: 'site_tool', description: '' }],
		});
		const request = (callId: string, interactionId: string) =>
			deliver({
				type: 'playground-webmcp-interaction-request',
				documentId: 'doc',
				callId,
				interactionId,
			});
		const sent = () => postMessage.mock.calls.map(([message]) => message);

		const handled = bridge.callTool(
			'site_tool',
			{},
			'with-handler',
			async (runInSite) => runInSite()
		);
		void bridge
			.callTool('site_tool', {}, 'without-handler')
			.catch(() => undefined);
		request('with-handler', 'i-1');
		request('without-handler', 'i-2');
		request('unknown-call', 'i-3');
		await vi.waitFor(() =>
			expect(sent()).toContainEqual({
				type: 'playground-webmcp-interaction-run',
				documentId: 'doc',
				interactionId: 'i-1',
			})
		);
		for (const interactionId of ['i-2', 'i-3']) {
			expect(sent()).toContainEqual({
				type: 'playground-webmcp-interaction-denied',
				documentId: 'doc',
				interactionId,
				error: expect.any(String),
			});
		}
		deliver({
			type: 'playground-webmcp-interaction-result',
			documentId: 'doc',
			interactionId: 'i-1',
			resultJson: '"confirmed"',
		});
		deliver({
			type: 'playground-webmcp-call-result',
			documentId: 'doc',
			callId: 'with-handler',
			resultJson: '"done"',
		});
		await expect(handled).resolves.toBe('done');

		let siteResult: Promise<unknown> | undefined;
		void bridge
			.callTool('site_tool', {}, 'cancelled', async (runInSite) => {
				siteResult = runInSite();
				return siteResult;
			})
			.catch(() => undefined);
		request('cancelled', 'i-4');
		await vi.waitFor(() => expect(siteResult).toBeDefined());
		bridge.cancelTool('cancelled');
		await expect(siteResult).rejects.toThrow();
		bridge.cancelTool('without-handler');
	});
});

// Execute the injected JavaScript itself: its per-call controller lives in the
// WordPress document, independently of the remote bridge's pending-call map. A site's
// interaction callback must run only when the parent relays the user's confirmation.
describe('WordPress WebMCP registry cancellation', () => {
	it('aborts only the requested tool and relays user interaction', async () => {
		const source = readFileSync(
			new URL('./playground-mu-plugin/0-playground.php', import.meta.url),
			'utf8'
		);
		const script = source.match(
			/function playground_enable_webmcp_bridge\(\) \{[\s\S]*?<script>([\s\S]*?)<\/script>/
		)?.[1];
		expect(script).toBeDefined();
		let receive!: (event: {
			source: unknown;
			origin: string;
			data: Record<string, unknown>;
		}) => void;
		let pageHide!: () => void;
		const parent = { postMessage: vi.fn() };
		const document: {
			modelContext?: {
				registerTool: (tool: {
					name: string;
					execute: (
						input: Record<string, unknown>,
						client: {
							signal: AbortSignal;
							requestUserInteraction: (
								callback: () => Promise<unknown>
							) => Promise<unknown>;
						}
					) => Promise<unknown>;
				}) => Promise<void>;
			};
		} = {};
		// Substitute the PHP-rendered configuration while exercising the actual
		// injected JavaScript across distinct app and WordPress origins.
		const renderedScript = script!.replace(
			"<?php echo json_encode(defined('PLAYGROUND_PARENT_ORIGIN') ? PLAYGROUND_PARENT_ORIGIN : null); ?>",
			JSON.stringify('https://playground.test')
		);
		runInNewContext(renderedScript, {
			window: {
				parent,
				location: { origin: 'https://wordpress.test' },
				addEventListener: (type: string, listener: typeof receive) => {
					if (type === 'message') receive = listener;
					if (type === 'pagehide')
						pageHide = listener as unknown as () => void;
				},
			},
			crypto: { randomUUID: () => 'document-1' },
			document,
			navigator: {},
			AbortController,
		});
		const signals: AbortSignal[] = [];
		const interaction = vi.fn(async () => 'confirmed');
		const outcomes: unknown[] = [];
		await document.modelContext!.registerTool({
			name: 'site_tool',
			execute: async (...[, client]) => {
				signals.push(client.signal);
				outcomes.push(
					await client.requestUserInteraction(interaction).then(
						(value) => value,
						(error: Error) => `refused: ${error.message}`
					)
				);
				return new Promise((_resolve, reject) => {
					client.signal.addEventListener('abort', () =>
						reject(client.signal.reason)
					);
				});
			},
		});
		const send = (data: Record<string, unknown>) =>
			receive({
				source: parent,
				origin: 'https://playground.test',
				data,
			});
		// A message queued for the previous document must not execute in this one.
		send({
			type: 'playground-webmcp-call-tool',
			name: 'site_tool',
			callId: 'old-document-call',
			documentId: 'document-0',
		});
		for (const callId of ['call-1', 'call-2']) {
			send({
				type: 'playground-webmcp-call-tool',
				name: 'site_tool',
				callId,
				documentId: 'document-1',
			});
		}
		const requests = () =>
			parent.postMessage.mock.calls
				.map(([message]) => message)
				.filter(
					(message) =>
						message.type === 'playground-webmcp-interaction-request'
				);
		await vi.waitFor(() => expect(requests()).toHaveLength(2));
		expect(interaction).not.toHaveBeenCalled();
		const [first, second] = requests();
		expect(first).toMatchObject({
			documentId: 'document-1',
			callId: 'call-1',
		});
		send({
			type: 'playground-webmcp-interaction-denied',
			documentId: 'document-1',
			interactionId: first.interactionId,
			error: 'No confirmation available.',
		});
		for (let i = 0; i < 2; i++) {
			send({
				type: 'playground-webmcp-interaction-run',
				documentId: 'document-1',
				interactionId: second.interactionId,
			});
		}
		await vi.waitFor(() => expect(outcomes).toHaveLength(2));
		expect(outcomes).toEqual([
			'refused: No confirmation available.',
			'confirmed',
		]);
		expect(interaction).toHaveBeenCalledTimes(1);
		expect(parent.postMessage).toHaveBeenCalledWith(
			{
				type: 'playground-webmcp-interaction-result',
				documentId: 'document-1',
				interactionId: second.interactionId,
				resultJson: '"confirmed"',
			},
			'https://playground.test'
		);
		send({ type: 'playground-webmcp-cancel-tool', callId: 'call-1' });
		expect(signals[0].aborted).toBe(true);
		expect(signals[1].aborted).toBe(false);
		await vi.waitFor(() =>
			expect(parent.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'playground-webmcp-call-result',
					callId: 'call-1',
					error: expect.any(String),
				}),
				'https://playground.test'
			)
		);
		send({ type: 'playground-webmcp-cancel-tool', callId: 'call-2' });
		pageHide();
		expect(parent.postMessage).toHaveBeenCalledWith(
			{
				type: 'playground-webmcp-document-hidden',
				documentId: 'document-1',
			},
			'https://playground.test'
		);
		expect(parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'playground-webmcp-tools-changed',
				documentId: 'document-1',
			}),
			'https://playground.test'
		);
	});
});

// Contract: the guest proxies only its bound wrapper and clears tools after a
// navigation without a registry. Wrapper forwarding and inner load messages
// arrive independently of the browser's outer iframe load event.
describe('remote access WebMCP bridge', () => {
	it('uses the guest frame, probes inner navigation, and releases pending calls', async () => {
		vi.useFakeTimers();
		let receive!: (event: MessageEvent) => void;
		const removeEventListener = vi.fn();
		vi.stubGlobal('window', {
			addEventListener: (_type: string, listener: typeof receive) => {
				receive = listener;
			},
			removeEventListener,
		});
		const postMessage = vi.fn();
		const contentWindow = { postMessage };
		const frame = {
			contentWindow,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		} as unknown as HTMLIFrameElement;
		const bridge = createWebMCPFrameBridge(frame, {
			origin: 'https://guest.test',
			relayMessages: true,
		});
		const listener = vi.fn();
		const unsubscribe = bridge.subscribe(listener);
		const deliver = (
			data: unknown,
			source: unknown = contentWindow,
			origin = 'https://guest.test'
		) => receive({ source, origin, data } as unknown as MessageEvent);
		const announcement = {
			type: 'remote-access-frame-message',
			payload: {
				type: 'playground-webmcp-tools-changed',
				documentId: 'guest-document',
				tools: [{ name: 'guest_tool', description: 'Guest tool' }],
			},
		};
		deliver(announcement, {});
		deliver(announcement, contentWindow, 'https://other.test');
		expect(listener).toHaveBeenCalledTimes(1);
		deliver(announcement);
		expect(listener).toHaveBeenLastCalledWith([
			{ name: 'guest_tool', description: 'Guest tool' },
		]);
		const result = bridge.callTool(
			'guest_tool',
			{ name: 'Guest' },
			'call-1'
		);
		expect(postMessage).toHaveBeenLastCalledWith(
			{
				type: 'remote-access-frame-forward',
				payload: {
					type: 'playground-webmcp-call-tool',
					callId: 'call-1',
					documentId: 'guest-document',
					name: 'guest_tool',
					arguments: { name: 'Guest' },
				},
			},
			'https://guest.test'
		);
		deliver({
			type: 'remote-access-frame-message',
			payload: {
				type: 'playground-webmcp-call-result',
				callId: 'call-1',
				documentId: 'guest-document',
				resultJson: '{"ok":true}',
			},
		});
		await expect(result).resolves.toEqual({ ok: true });
		const navigatedCall = bridge.callTool(
			'guest_tool',
			{},
			'before-navigation'
		);
		postMessage.mockClear();
		deliver({
			type: 'remote-access-frame-message',
			payload: {
				type: 'playground-webmcp-document-hidden',
				documentId: 'guest-document',
			},
		});
		deliver({
			type: 'remote-access-frame-load',
			href: 'https://guest.test/plain',
		});
		await expect(navigatedCall).rejects.toThrow('WordPress page changed');
		expect(postMessage).toHaveBeenCalledTimes(1);
		expect(postMessage).toHaveBeenLastCalledWith(
			{
				type: 'remote-access-frame-forward',
				payload: { type: 'playground-webmcp-list-tools' },
			},
			'https://guest.test'
		);
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(listener).toHaveBeenLastCalledWith([]);
		unsubscribe();
		listener.mockClear();
		deliver(announcement);
		expect(listener).not.toHaveBeenCalled();
		const pending = bridge.callTool('guest_tool', {}, 'call-2');
		bridge.dispose();
		expect(postMessage).toHaveBeenLastCalledWith(
			{
				type: 'remote-access-frame-forward',
				payload: {
					type: 'playground-webmcp-cancel-tool',
					callId: 'call-2',
					documentId: 'guest-document',
				},
			},
			'https://guest.test'
		);
		await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		expect(removeEventListener).toHaveBeenCalledWith('message', receive);
		expect(vi.getTimerCount()).toBe(0);
	});
});

// Contract: calls belong to the document that advertised their tool. A new
// document can announce tools and execute mutations before its load event or
// the previous document's pagehide message reaches the parent.
describe.each([false, true])(
	'WebMCP document ownership (relay: %s)',
	(relayMessages) => {
		it('keeps a new document’s call alive across load and a late departure', async () => {
			vi.useFakeTimers();
			let receive!: (event: MessageEvent) => void;
			let load!: () => void;
			vi.stubGlobal('window', {
				addEventListener: (_type: string, listener: typeof receive) => {
					receive = listener;
				},
				removeEventListener: vi.fn(),
			});
			const postMessage = vi.fn();
			const contentWindow = { postMessage };
			const frame = {
				contentWindow,
				addEventListener: (_type: string, listener: () => void) => {
					load = listener;
				},
				removeEventListener: vi.fn(),
			} as unknown as HTMLIFrameElement;
			const bridge = createWebMCPFrameBridge(frame, { relayMessages });
			const deliver = (payload: Record<string, unknown>) =>
				receive({
					source: contentWindow,
					origin: 'https://wordpress.test',
					data: relayMessages
						? { type: 'remote-access-frame-message', payload }
						: payload,
				} as unknown as MessageEvent);
			const announce = (documentId: string) =>
				deliver({
					type: 'playground-webmcp-tools-changed',
					documentId,
					tools: [
						{ name: 'save_recipe', description: 'Save a recipe' },
					],
				});
			announce('old');
			const oldCall = bridge.callTool('save_recipe', {}, 'old-call');
			announce('new');
			await expect(oldCall).rejects.toThrow('check before retrying');
			const current = bridge.callTool('save_recipe', {}, 'new-call');
			const settled = vi.fn();
			void current.then(settled, settled);
			if (relayMessages) {
				receive({
					source: contentWindow,
					origin: 'https://wordpress.test',
					data: { type: 'remote-access-frame-load' },
				} as unknown as MessageEvent);
			} else {
				load();
			}
			deliver({
				type: 'playground-webmcp-document-hidden',
				documentId: 'old',
			});
			// A late result from a different document must not settle this call.
			deliver({
				type: 'playground-webmcp-call-result',
				documentId: 'old',
				callId: 'new-call',
				resultJson: 'false',
			});
			await Promise.resolve();
			expect(settled).not.toHaveBeenCalled();
			deliver({
				type: 'playground-webmcp-call-result',
				documentId: 'new',
				callId: 'new-call',
				resultJson: '{"saved":true}',
			});
			await expect(current).resolves.toEqual({ saved: true });
			bridge.dispose();
			expect(vi.getTimerCount()).toBe(0);
		});
	}
);
