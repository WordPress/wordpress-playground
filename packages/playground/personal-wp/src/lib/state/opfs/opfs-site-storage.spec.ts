import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./opfs-blueprint-bundle-storage', () => ({
	loadPersistedBlueprintBundle: vi.fn(),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

// Contract: only a missing site directory means absence. Directory access and
// metadata reads fail independently, and recoverable files must not look absent.
describe('OPFS site reads', () => {
	it.each(['missing', 'metadata-missing', 'metadata-invalid', 'denied'])(
		'distinguishes %s from a confirmed absent site',
		async (failure) => {
			const siteDirectory = {
				getFileHandle: vi.fn(async () => {
					if (failure === 'metadata-missing') {
						throw new DOMException(
							'Missing metadata',
							'NotFoundError'
						);
					}
					return {
						getFile: async () => ({
							text: async () => 'invalid JSON',
						}),
					};
				}),
			};
			const sitesRoot = {
				getDirectoryHandle: vi.fn(async () => {
					if (failure === 'missing' || failure === 'denied') {
						throw new DOMException(
							'Cannot open directory',
							failure === 'missing'
								? 'NotFoundError'
								: 'NotAllowedError'
						);
					}
					return siteDirectory;
				}),
			};
			vi.stubGlobal('navigator', {
				storage: {
					getDirectory: async () => ({
						getDirectoryHandle: async () => sitesRoot,
					}),
				},
			});
			const { opfsSiteStorage } = await import('./opfs-site-storage');
			const read = opfsSiteStorage!.read('default');
			if (failure === 'missing') {
				await expect(read).resolves.toBeUndefined();
			} else {
				await expect(read).rejects.toThrow();
			}
		}
	);
});
