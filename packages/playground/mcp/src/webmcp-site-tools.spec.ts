import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
	PlaygroundClient,
	WebMCPToolDescriptor,
} from '@wp-playground/remote';
import type { ModelContextTool } from './webmcp';
import { startWebMCPSiteToolProxy } from './webmcp-site-tools';

afterEach(() => vi.unstubAllGlobals());

describe('site tool cancellation', () => {
	// Contract: an execution abort reaches exactly the pending site call, and
	// completed calls release their listener. The independent abort event can
	// otherwise be dropped by the proxy or leak into a later execution.
	it('forwards an in-flight abort using the same call ID', async () => {
		const { tool, call, cancel, finish } = await registerSiteTool();
		const controller = new AbortController();
		const result = tool.execute({}, { signal: controller.signal });
		controller.abort();
		expect(cancel).toHaveBeenCalledWith(call.mock.calls[0][2]);
		finish('late result');
		await expect(result).resolves.toMatchObject({
			error: expect.any(String),
		});
	});

	it('removes the abort listener after completion', async () => {
		const { tool, cancel, finish } = await registerSiteTool();
		const controller = new AbortController();
		const result = tool.execute({}, { signal: controller.signal });
		finish('done');
		await expect(result).resolves.toBe('done');
		controller.abort();
		expect(cancel).not.toHaveBeenCalled();
	});
});

async function registerSiteTool() {
	let tool!: ModelContextTool;
	let finish!: (value: unknown) => void;
	const call = vi.fn<
		(
			name: string,
			input: Record<string, unknown>,
			callId?: string
		) => Promise<unknown>
	>(
		() =>
			new Promise<unknown>((resolve) => {
				finish = resolve;
			})
	);
	const cancel = vi.fn(async () => undefined);
	vi.stubGlobal('document', {
		modelContext: {
			registerTool: (registered: ModelContextTool) => {
				tool = registered;
			},
		},
	});
	const client = {
		onWebMCPToolsChanged: async (
			listener: (tools: WebMCPToolDescriptor[]) => void
		) => {
			listener([{ name: 'site_tool', description: 'A site tool.' }]);
		},
		callWebMCPTool: call,
		cancelWebMCPTool: cancel,
	} as unknown as PlaygroundClient;
	startWebMCPSiteToolProxy(client);
	await Promise.resolve();
	return { tool, call, cancel, finish: (value: unknown) => finish(value) };
}
