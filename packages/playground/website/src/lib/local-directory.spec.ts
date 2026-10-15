// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseLocalDirectory } from './local-directory';
import { isInOriginShell } from './origin-isolation';
import {
	getIndexedDB,
	loadDirectoryHandle,
} from './state/opfs/opfs-directory-handle-storage';

vi.mock('./origin-isolation', () => ({ isInOriginShell: vi.fn() }));
vi.mock('./state/opfs/opfs-directory-handle-storage', () => ({
	getIndexedDB: vi.fn(),
	loadDirectoryHandle: vi.fn(),
}));

let channel: {
	onmessage: (event: { data: string }) => Promise<void>;
	close: ReturnType<typeof vi.fn>;
};
const remove = vi.fn();

beforeEach(() => {
	vi.useFakeTimers();
	vi.mocked(isInOriginShell).mockReturnValue(true);
	vi.stubGlobal(
		'BroadcastChannel',
		class {
			constructor() {
				channel = {
					onmessage: async (_event: { data: string }) => {},
					close: vi.fn(),
				};
				return channel;
			}
		}
	);
	vi.spyOn(window, 'open').mockReturnValue(null);
	vi.mocked(loadDirectoryHandle).mockReset();
	remove.mockReset();
	vi.mocked(getIndexedDB).mockResolvedValue({
		transaction() {
			const transaction = {
				objectStore: () => ({ delete: remove }),
				oncomplete: () => {},
			};
			queueMicrotask(() => transaction.oncomplete());
			return transaction;
		},
	} as any);
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('guided native directory selection', () => {
	it('uses the normal picker when the app is not in the root shell', async () => {
		vi.mocked(isInOriginShell).mockReturnValue(false);
		const picker = vi.fn().mockResolvedValue({ name: 'Selected' });
		vi.stubGlobal('showDirectoryPicker', picker);
		expect(await chooseLocalDirectory()).toEqual({ name: 'Selected' });
		expect(picker).toHaveBeenCalledWith({
			id: 'playground-directory',
			mode: 'readwrite',
		});
		expect(window.open).not.toHaveBeenCalled();
	});
	it('loads the real handle only after the popup completes and confirms its grant', async () => {
		const handle = {
			queryPermission: vi.fn().mockResolvedValue('granted'),
		};
		vi.mocked(loadDirectoryHandle).mockResolvedValue(handle as any);
		const selected = chooseLocalDirectory();
		expect(window.open).toHaveBeenCalledWith(
			expect.any(URL),
			'_blank',
			expect.stringContaining('noopener')
		);
		await channel.onmessage({ data: 'ready' });
		expect(loadDirectoryHandle).not.toHaveBeenCalled();
		await channel.onmessage({ data: 'complete' });
		expect(await selected).toBe(handle);
		expect(handle.queryPermission).toHaveBeenCalledWith({
			mode: 'readwrite',
		});
		expect(channel.close).toHaveBeenCalled();
	});
	it('does not return a handle whose permission is still prompt', async () => {
		vi.mocked(loadDirectoryHandle).mockResolvedValue({
			queryPermission: async () => 'prompt',
		} as any);
		const selected = chooseLocalDirectory();
		const rejected = expect(selected).rejects.toThrow(
			'Allow on every visit'
		);
		await channel.onmessage({ data: 'complete' });
		await rejected;
	});
	it('cancels without loading the pending handle', async () => {
		const selected = chooseLocalDirectory();
		const rejected = expect(selected).rejects.toMatchObject({
			name: 'AbortError',
		});
		await channel.onmessage({ data: 'cancelled' });
		await rejected;
		expect(loadDirectoryHandle).not.toHaveBeenCalled();
		expect(channel.close).toHaveBeenCalled();
	});
	it('reports a blocked popup and releases the pending selection', async () => {
		const selected = chooseLocalDirectory();
		const rejected = expect(selected).rejects.toThrow('Allow popups');
		await vi.advanceTimersByTimeAsync(15000);
		await rejected;
		expect(channel.close).toHaveBeenCalled();
		expect(remove).toHaveBeenCalledWith(
			expect.stringMatching(/^directory-setup:/)
		);
	});
});
