import { directoryHandleFromMountDevice } from './browser-fs';
import { getEmbeddedSiteOpfsPath } from './embedded-site-opfs-path';

describe('getEmbeddedSiteOpfsPath', () => {
	it('places embedded sites in their own OPFS namespace', () => {
		expect(getEmbeddedSiteOpfsPath('demo-site')).toBe(
			'/embedded-sites/site-demo-site'
		);
	});

	it('encodes the storage key as a single path segment', () => {
		expect(getEmbeddedSiteOpfsPath('a/b')).toBe(
			'/embedded-sites/site-a%2Fb'
		);
		expect(getEmbeddedSiteOpfsPath('a?b')).toBe(
			'/embedded-sites/site-a%3Fb'
		);
		expect(getEmbeddedSiteOpfsPath('..')).toBe('/embedded-sites/site-..');
	});
});

describe('embedded site OPFS mount device', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens the path derived from its storage key', async () => {
		const getDirectoryHandle = vi.fn();
		const directoryHandle = {
			getDirectoryHandle,
		} as unknown as FileSystemDirectoryHandle;
		getDirectoryHandle.mockResolvedValue(directoryHandle);
		vi.stubGlobal('navigator', {
			storage: {
				getDirectory: vi.fn(async () => directoryHandle),
			},
		});

		await directoryHandleFromMountDevice({
			type: 'opfs-embedded-site',
			storageKey: 'a/b',
		});

		expect(getDirectoryHandle).toHaveBeenNthCalledWith(
			1,
			'embedded-sites',
			{ create: true }
		);
		expect(getDirectoryHandle).toHaveBeenNthCalledWith(2, 'site-a%2Fb', {
			create: true,
		});
	});
});
