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

// Execute the injected JavaScript itself: its per-call controller lives in the
// WordPress document, independently of the remote bridge's pending-call map.
describe('WordPress WebMCP registry cancellation', () => {
	it('aborts only the requested tool and preserves user interaction', async () => {
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
				},
			},
			document,
			navigator: {},
			AbortController,
		});
		const signals: AbortSignal[] = [];
		const interaction = vi.fn(async () => 'confirmed');
		await document.modelContext!.registerTool({
			name: 'site_tool',
			execute: async (...[, client]) => {
				signals.push(client.signal);
				await client.requestUserInteraction(interaction);
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
		for (const callId of ['call-1', 'call-2']) {
			send({
				type: 'playground-webmcp-call-tool',
				name: 'site_tool',
				callId,
			});
		}
		await vi.waitFor(() => expect(interaction).toHaveBeenCalledTimes(2));
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
	});
});
