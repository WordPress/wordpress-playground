import {
	directoryHandleFromMountDevice,
	getExistingEmbeddedSiteOpfsDirectoryHandle,
} from './browser-fs';

describe('embedded site OPFS directory handle', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens an existing directory without creating it', async () => {
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

		await getExistingEmbeddedSiteOpfsDirectoryHandle('a/b');

		expect(getDirectoryHandle).toHaveBeenNthCalledWith(
			1,
			'embedded-sites',
			{ create: false }
		);
		expect(getDirectoryHandle).toHaveBeenNthCalledWith(2, 'site-a%2Fb', {
			create: false,
		});
	});

	it('creates the directory for an embedded site mount', async () => {
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
