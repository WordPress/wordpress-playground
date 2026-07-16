import { afterEach, describe, expect, it, vi } from 'vitest';

describe('directory handle storage', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('keeps the picker-granted handle for mounts in the current page', async () => {
		const pickerHandle = {
			name: 'project',
			queryPermission: vi.fn().mockResolvedValue('granted'),
		} as unknown as FileSystemDirectoryHandle;
		const get = vi.fn();
		const database = {
			transaction: vi.fn(() => {
				const transaction = {
					error: null,
					oncomplete: undefined as (() => void) | undefined,
					objectStore: () => ({
						put: () => undefined,
						get,
					}),
				};
				queueMicrotask(() => transaction.oncomplete?.());
				return transaction;
			}),
		};
		vi.stubGlobal('indexedDB', {
			open: () => {
				const request = {
					onsuccess: undefined as
						| ((event: {
								target: { result: typeof database };
						  }) => void)
						| undefined,
				};
				queueMicrotask(() =>
					request.onsuccess?.({ target: { result: database } })
				);
				return request;
			},
		});

		const { loadDirectoryHandle, saveDirectoryHandle } =
			await import('./opfs-directory-handle-storage');
		await saveDirectoryHandle('project', pickerHandle);

		expect(await loadDirectoryHandle('project')).toBe(pickerHandle);
		expect(get).not.toHaveBeenCalled();
	});
});
