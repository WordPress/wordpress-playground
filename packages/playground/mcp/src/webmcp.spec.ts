import { afterEach, expect, it, vi } from 'vitest';
import type { PlaygroundBridgeConfig } from './bridge-client';
import type { ModelContextTool } from './webmcp';
import { registerWebMCPTools, unregisterWebMCPTools } from './webmcp';

const config: PlaygroundBridgeConfig = {
	list: () => [],
	getClient: () => undefined,
	rename: async () => {},
	saveInBrowser: async () => ({ slug: 'site', storage: 'temporary' }),
};

afterEach(() => {
	unregisterWebMCPTools();
	vi.unstubAllGlobals();
});

it('unregisters Playground tools without removing other tools and can register again', async () => {
	const { tools } = mockRegistry();
	await registerWebMCPTools(config);
	expect(tools.has('playground_get_site_info')).toBe(true);

	unregisterWebMCPTools();
	expect([...tools.keys()]).toEqual(['other_tool']);

	await registerWebMCPTools(config);
	expect(tools.has('playground_get_site_info')).toBe(true);
	unregisterWebMCPTools();
	expect([...tools.keys()]).toEqual(['other_tool']);
});

it('ignores a canceled registration that fails after a new registration starts', async () => {
	const { tools, rejectPending } = mockRegistry(true);
	const pending = registerWebMCPTools(config);
	unregisterWebMCPTools();

	await registerWebMCPTools(config);
	rejectPending();
	await expect(pending).resolves.toBeUndefined();
	expect(tools.has('playground_get_site_info')).toBe(true);

	unregisterWebMCPTools();
	expect([...tools.keys()]).toEqual(['other_tool']);
});

function mockRegistry(delayFirst = false) {
	const tools = new Map<string, AbortSignal | undefined>([
		['other_tool', undefined],
	]);
	const signals = new Set<AbortSignal>();
	let rejectPending!: () => void;
	vi.stubGlobal('document', {
		modelContext: {
			registerTool(
				tool: ModelContextTool,
				{ signal }: { signal: AbortSignal }
			) {
				tools.set(tool.name, signal);
				if (!signals.has(signal)) {
					signals.add(signal);
					signal.addEventListener('abort', () => {
						for (const [name, owner] of tools) {
							if (owner === signal) tools.delete(name);
						}
					});
				}
				if (delayFirst) {
					delayFirst = false;
					return new Promise<void>((_, reject) => {
						rejectPending = () =>
							reject(new Error('Registration canceled'));
					});
				}
			},
		},
	});
	return { tools, rejectPending: () => rejectPending() };
}
