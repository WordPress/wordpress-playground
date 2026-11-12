// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteAccessConnect } from './index';

const mocks = vi.hoisted(() => ({
	storage: { read: vi.fn() } as
		| { read: ReturnType<typeof vi.fn> }
		| undefined,
	registerTool: vi.fn(),
}));
vi.mock('../../lib/state/opfs/opfs-site-storage', () => ({
	get opfsSiteStorage() {
		return mocks.storage;
	},
}));
vi.mock('@wp-playground/mcp/client', () => ({
	getModelContext: () => ({ registerTool: mocks.registerTool }),
}));
vi.mock('../../lib/state/url/app-base-url', () => ({
	getAppBaseUrl: () => new URL('https://my.wordpress.test/'),
}));
vi.mock('@php-wasm/logger', () => ({ logger: { warn: vi.fn() } }));

let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	mocks.registerTool.mockClear();
	vi.unstubAllGlobals();
});

// Contract: status remains available on storage failure and reflects subsequent
// storage changes. OPFS errors and changes in another tab arrive independently
// from tool registration and page focus.
describe('connection status tool', () => {
	async function mount() {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		root = createRoot(document.createElement('div'));
		await act(async () => root!.render(createElement(RemoteAccessConnect)));
		return mocks.registerTool.mock.calls[0][0] as {
			execute(input: Record<string, unknown>): Promise<unknown>;
		};
	}

	it.each(['unavailable', 'unreadable'])(
		'reports unknown when storage is %s',
		async (failure) => {
			mocks.storage =
				failure === 'unavailable'
					? undefined
					: {
							read: vi
								.fn()
								.mockRejectedValue(
									new Error('Unreadable metadata')
								),
						};
			const tool = await mount();
			let result: unknown;
			await act(async () => {
				result = await tool.execute({});
			});
			expect(result).toMatchObject({ hasSavedMainSite: null });
		}
	);

	it('rechecks on execution and focus', async () => {
		const read = vi.fn().mockResolvedValue(undefined);
		mocks.storage = { read };
		const tool = await mount();
		let result: unknown;
		await act(async () => {
			result = await tool.execute({});
		});
		expect(result).toMatchObject({ hasSavedMainSite: false });
		read.mockResolvedValue({ slug: 'default' });
		await act(async () => {
			result = await tool.execute({});
		});
		expect(result).toMatchObject({ hasSavedMainSite: true });
		read.mockClear();
		await act(async () => {
			window.dispatchEvent(new Event('focus'));
		});
		expect(read).toHaveBeenCalledTimes(1);
	});
});
