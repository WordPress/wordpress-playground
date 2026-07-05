// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/remote';
import {
	getPlaygroundDefinedPHPConstants,
	persistTemporarySite,
} from './persist-temporary-site';

const mocks = vi.hoisted(() => ({
	getDirectoryPathForSlug: vi.fn((slug: string) => `/sites/${slug}`),
	getDirectoryPathForSite: vi.fn(
		(site: { slug: string }) => `/sites/${site.slug}`
	),
	getSetupUrlFromUrl: vi.fn((url: URL) => url),
	opfsSiteStorage: {
		create: vi.fn(),
		delete: vi.fn(),
		read: vi.fn(),
	},
	opfsSiteStorageMock: undefined as
		| {
				create: ReturnType<typeof vi.fn>;
				delete: ReturnType<typeof vi.fn>;
				read: ReturnType<typeof vi.fn>;
		  }
		| undefined,
	persistBlueprintBundleAtSitePath: vi.fn(),
	redirectTo: vi.fn(),
	selectClientBySiteSlug: vi.fn(),
	selectClientInfoBySiteSlug: vi.fn(),
	selectSiteBySlug: vi.fn(),
	updateClientInfo: vi.fn((payload) => ({
		type: 'clients/updateClientInfo',
		payload,
	})),
	updateSite: vi.fn(() => async () => undefined),
	updateSiteMetadata: vi.fn(() => async () => undefined),
}));

vi.mock('@php-wasm/logger', () => ({
	logger: {
		error: vi.fn(),
	},
}));

vi.mock('../opfs/opfs-blueprint-bundle-storage', () => ({
	persistBlueprintBundleAtSitePath: mocks.persistBlueprintBundleAtSitePath,
}));

vi.mock('../opfs/opfs-directory-handle-storage', () => ({
	saveDirectoryHandle: vi.fn(),
}));

vi.mock('../opfs/opfs-site-storage', () => ({
	getDirectoryPathForSite: mocks.getDirectoryPathForSite,
	getDirectoryPathForSlug: mocks.getDirectoryPathForSlug,
	get opfsSiteStorage() {
		return mocks.opfsSiteStorage;
	},
}));

vi.mock('../playground-identity', () => ({
	getSetupUrlFromUrl: mocks.getSetupUrlFromUrl,
}));

vi.mock('../url/router', () => ({
	PlaygroundRoute: {
		site: vi.fn(() => '/website-server/#/site/test-site'),
	},
	redirectTo: mocks.redirectTo,
}));

vi.mock('./store', () => ({
	selectActiveSite: vi.fn(),
	setActiveSite: vi.fn((slug: string) => ({
		type: 'ui/setActiveSite',
		payload: slug,
	})),
}));

vi.mock('./slice-clients', () => ({
	selectClientBySiteSlug: mocks.selectClientBySiteSlug,
	selectClientInfoBySiteSlug: mocks.selectClientInfoBySiteSlug,
	updateClientInfo: mocks.updateClientInfo,
}));

vi.mock('./slice-sites', () => ({
	selectSiteBySlug: mocks.selectSiteBySlug,
	updateSite: mocks.updateSite,
	updateSiteMetadata: mocks.updateSiteMetadata,
}));

describe('getPlaygroundDefinedPHPConstants', () => {
	it('returns no constants when Playground has not defined any', async () => {
		const playground = createPlaygroundWithConstants(undefined);

		await expect(
			getPlaygroundDefinedPHPConstants(playground)
		).resolves.toEqual({});
		expect(playground.readFileAsText).not.toHaveBeenCalled();
	});

	it('reads constants registered through the live Playground API', async () => {
		const playground = createPlaygroundWithConstants(
			JSON.stringify({ WP_DEBUG: true, WPLANG: 'pl_PL' })
		);

		await expect(
			getPlaygroundDefinedPHPConstants(playground)
		).resolves.toEqual({
			WP_DEBUG: true,
			WPLANG: 'pl_PL',
		});
	});

	it('rejects invalid constants instead of silently dropping them', async () => {
		const playground = createPlaygroundWithConstants('not json');

		await expect(
			getPlaygroundDefinedPHPConstants(playground)
		).rejects.toBeInstanceOf(SyntaxError);
	});

	it('rejects JSON that is not a constants object', async () => {
		const playground = createPlaygroundWithConstants('[]');

		await expect(
			getPlaygroundDefinedPHPConstants(playground)
		).rejects.toThrow('must contain a JSON object');
	});
});

describe('persistTemporarySite', () => {
	beforeEach(() => {
		if (!mocks.opfsSiteStorageMock) {
			mocks.opfsSiteStorageMock = mocks.opfsSiteStorage;
		}
		mocks.opfsSiteStorage = mocks.opfsSiteStorageMock;
		mocks.getDirectoryPathForSlug.mockReset();
		mocks.getDirectoryPathForSlug.mockImplementation(
			(slug: string) => `/sites/${slug}`
		);
		mocks.getDirectoryPathForSite.mockReset();
		mocks.getDirectoryPathForSite.mockImplementation(
			(site: { slug: string }) => `/sites/${site.slug}`
		);
		mocks.getSetupUrlFromUrl.mockReset();
		mocks.getSetupUrlFromUrl.mockImplementation((url: URL) => url);
		mocks.opfsSiteStorage.create.mockReset();
		mocks.opfsSiteStorage.delete.mockReset();
		mocks.opfsSiteStorage.read.mockReset();
		mocks.persistBlueprintBundleAtSitePath.mockReset();
		mocks.redirectTo.mockReset();
		mocks.selectClientBySiteSlug.mockReset();
		mocks.selectClientInfoBySiteSlug.mockReset();
		mocks.selectSiteBySlug.mockReset();
		mocks.updateClientInfo.mockClear();
		mocks.updateSite.mockReset();
		mocks.updateSite.mockReturnValue(async () => undefined);
		mocks.updateSiteMetadata.mockReset();
		mocks.updateSiteMetadata.mockReturnValue(async () => undefined);
	});

	it('reuses a temporary placeholder when the runtime is still mounted to it', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => true);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientInfoBySiteSlug.mockReturnValue({
			client: playground,
			opfsMountDescriptor: {
				device: {
					type: 'opfs',
					path: '/sites/test-site',
				},
				mountpoint: '/wordpress',
			},
		});
		mocks.opfsSiteStorage.read.mockResolvedValue({
			metadata: { storage: 'none' },
		});
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			metadata: {
				id: 'test-site-id',
				name: 'Test site',
				storage: 'none',
				runtimeConfiguration: {},
				originalBlueprint: {},
				originalBlueprintSource: { type: 'none' },
			},
		});
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			return action;
		});

		await persistTemporarySite('test-site', 'opfs')(
			dispatch as any,
			getState as any
		);

		expect(mocks.opfsSiteStorage.delete).not.toHaveBeenCalled();
		expect(mocks.opfsSiteStorage.create).not.toHaveBeenCalled();
		expect(playground.unmountOpfs).toHaveBeenCalledWith('/wordpress');
	});

	it('reuses a temporary placeholder stored at the site resolved OPFS path', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => true);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.getDirectoryPathForSlug.mockReturnValue('/sites/a%2Fb');
		mocks.getDirectoryPathForSite.mockReturnValue('/sites/site-a-b');
		mocks.selectClientInfoBySiteSlug.mockReturnValue({
			client: playground,
			opfsMountDescriptor: {
				device: {
					type: 'opfs',
					path: '/sites/site-a-b',
				},
				mountpoint: '/wordpress',
			},
		});
		mocks.opfsSiteStorage.read.mockResolvedValue({
			metadata: { storage: 'none' },
		});
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'a/b',
			metadata: {
				id: 'test-site-id',
				name: 'Test site',
				storage: 'none',
				runtimeConfiguration: {},
				originalBlueprint: {},
				originalBlueprintSource: { type: 'none' },
			},
		});
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			return action;
		});

		await persistTemporarySite('a/b', 'opfs')(
			dispatch as any,
			getState as any
		);

		expect(mocks.opfsSiteStorage.delete).not.toHaveBeenCalled();
		expect(mocks.opfsSiteStorage.create).not.toHaveBeenCalled();
		expect(playground.unmountOpfs).toHaveBeenCalledWith('/wordpress');
	});

	it('clears an unmounted temporary placeholder before retrying a save', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn();
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.opfsSiteStorage.read.mockResolvedValue({
			metadata: { storage: 'none' },
		});
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			metadata: {
				id: 'test-site-id',
				name: 'Test site',
				storage: 'none',
				runtimeConfiguration: {},
				originalBlueprint: {},
				originalBlueprintSource: { type: 'none' },
			},
		});
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			return action;
		});

		await persistTemporarySite('test-site', 'opfs')(
			dispatch as any,
			getState as any
		);

		expect(mocks.opfsSiteStorage.delete).toHaveBeenCalledWith('test-site');
		expect(mocks.opfsSiteStorage.create).toHaveBeenCalled();
	});

	it('keeps the save in an error state when metadata persistence fails', async () => {
		const metadataError = new Error('metadata write failed');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.mountOpfs = vi.fn(async () => undefined);
		playground.unmountOpfs = vi.fn();
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			metadata: {
				name: 'Test site',
				persistence: 'autosave',
				storage: 'opfs',
				whenCreated: 1,
				whenLastUsed: 1,
			},
		});
		mocks.updateSite.mockReturnValueOnce(async () => {
			throw metadataError;
		});
		const dispatchedActions: any[] = [];
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			dispatchedActions.push(action);
			return action;
		});

		await expect(
			persistTemporarySite('test-site', 'opfs', {
				persistence: 'autosave',
			})(dispatch as any, getState as any)
		).rejects.toThrow(metadataError);

		expect(playground.mountOpfs).toHaveBeenCalled();
		const syncUpdates = dispatchedActions.map(
			(action) => action.payload.changes.opfsSync
		);
		expect(syncUpdates).toEqual([
			{
				status: 'syncing',
				operation: 'autosave',
			},
			{
				status: 'error',
				operation: 'autosave',
			},
		]);
	});

	it('uses the resolved OPFS site path for legacy bundle and file sync writes', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.mountOpfs = vi.fn(async () => undefined);
		playground.unmountOpfs = vi.fn();
		const bundle = {
			read: vi.fn(),
			listFiles: vi.fn(),
			isDir: vi.fn(),
		};
		mocks.getDirectoryPathForSite.mockReturnValue('/sites/site-a-b');
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'a/b',
			originalUrlParams: {},
			metadata: {
				id: 'test-site-id',
				name: 'Test site',
				persistence: 'autosave',
				storage: 'opfs',
				whenCreated: 1,
				whenLastUsed: 1,
				runtimeConfiguration: {},
				originalBlueprint: bundle,
				originalBlueprintSource: { type: 'opfs-site' },
			},
		});
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			return action;
		});

		await persistTemporarySite('a/b', 'opfs', {
			persistence: 'autosave',
		})(dispatch as any, getState as any);

		expect(mocks.persistBlueprintBundleAtSitePath).toHaveBeenCalledWith(
			'/sites/site-a-b',
			bundle
		);
		expect(playground.mountOpfs).toHaveBeenCalledWith(
			{
				device: {
					type: 'opfs',
					path: '/sites/site-a-b',
				},
				mountpoint: '/wordpress',
				initialSyncDirection: 'memfs-to-opfs',
			},
			expect.any(Function)
		);
	});

	it('persists explicit save metadata and setup URL in one site update', async () => {
		const playground = createPlaygroundWithConstants(
			JSON.stringify({ WP_DEBUG: true })
		) as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.mountOpfs = vi.fn(async () => undefined);
		playground.unmountOpfs = vi.fn();
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			originalUrlParams: {
				searchParams: {
					language: 'pl_PL',
					plugin: ['akismet', 'gutenberg'],
				},
				hash: '#blueprint',
			},
			metadata: {
				id: 'test-site-id',
				name: 'Test site',
				persistence: 'explicit',
				storage: 'none',
				whenCreated: 1,
				whenLastUsed: 1,
				runtimeConfiguration: {},
				originalBlueprint: {},
				originalBlueprintSource: { type: 'none' },
			},
		});
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			return action;
		});

		await persistTemporarySite('test-site', 'opfs')(
			dispatch as any,
			getState as any
		);

		expect(mocks.updateSite).toHaveBeenCalledTimes(1);
		expect(mocks.updateSite).toHaveBeenCalledWith({
			slug: 'test-site',
			changes: {
				originalUrlParams: {
					searchParams: {
						language: 'pl_PL',
						plugin: ['akismet', 'gutenberg'],
					},
					hash: '#blueprint',
				},
				metadata: expect.objectContaining({
					storage: 'opfs',
					persistence: 'explicit',
					playgroundDefinedConstants: { WP_DEBUG: true },
				}),
			},
		});
	});

	it('can save to a local directory when OPFS metadata storage is unavailable', async () => {
		mocks.opfsSiteStorage = undefined as any;
		const localFsHandle = {} as FileSystemDirectoryHandle;
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.mountOpfs = vi.fn(async () => undefined);
		playground.unmountOpfs = vi.fn();
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			originalUrlParams: {
				searchParams: {
					php: '8.4',
				},
			},
			metadata: {
				id: 'test-site-id',
				name: 'Test site',
				persistence: 'explicit',
				storage: 'none',
				whenCreated: 1,
				whenLastUsed: 1,
				runtimeConfiguration: {},
				originalBlueprint: {},
				originalBlueprintSource: { type: 'none' },
			},
		});
		const dispatchedActions: any[] = [];
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			dispatchedActions.push(action);
			return action;
		});

		await persistTemporarySite('test-site', 'local-fs', {
			localFsHandle,
		})(dispatch as any, getState as any);

		expect(mocks.opfsSiteStorageMock?.create).not.toHaveBeenCalled();
		expect(playground.mountOpfs).toHaveBeenCalledWith(
			{
				device: {
					type: 'local-fs',
					handle: localFsHandle,
				},
				mountpoint: '/wordpress',
				initialSyncDirection: 'memfs-to-opfs',
			},
			expect.any(Function)
		);
		expect(mocks.updateSite).toHaveBeenCalledWith({
			slug: 'test-site',
			changes: {
				originalUrlParams: {
					searchParams: {
						php: '8.4',
					},
					hash: '',
				},
				metadata: expect.objectContaining({
					storage: 'local-fs',
					persistence: 'explicit',
				}),
			},
		});
		expect(dispatchedActions.at(-1)).toEqual(
			mocks.updateClientInfo({
				siteSlug: 'test-site',
				changes: {
					opfsSync: undefined,
				},
			})
		);
	});

	it('restores the previous mount when saving to a local directory fails', async () => {
		const previousMountDescriptor = {
			device: {
				type: 'opfs',
				path: '/sites/test-site',
			},
			mountpoint: '/wordpress',
		} as const;
		const localFsHandle = {} as FileSystemDirectoryHandle;
		const localFsError = new Error('local directory unavailable');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => true);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async (descriptor) => {
			if (descriptor.device.type === 'local-fs') {
				throw localFsError;
			}
		});
		mocks.selectClientInfoBySiteSlug.mockReturnValue({
			client: playground,
			opfsMountDescriptor: previousMountDescriptor,
		});
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			metadata: {
				name: 'Test site',
				persistence: 'autosave',
				storage: 'opfs',
				whenCreated: 1,
				whenLastUsed: 1,
			},
		});
		const dispatchedActions: any[] = [];
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			dispatchedActions.push(action);
			return action;
		});

		await expect(
			persistTemporarySite('test-site', 'local-fs', {
				localFsHandle,
			})(dispatch as any, getState as any)
		).rejects.toThrow(localFsError);

		expect(playground.unmountOpfs).toHaveBeenCalledWith('/wordpress');
		expect(playground.mountOpfs).toHaveBeenNthCalledWith(
			1,
			{
				device: {
					type: 'local-fs',
					handle: localFsHandle,
				},
				mountpoint: '/wordpress',
				initialSyncDirection: 'memfs-to-opfs',
			},
			expect.any(Function)
		);
		expect(playground.mountOpfs).toHaveBeenNthCalledWith(2, {
			...previousMountDescriptor,
			initialSyncDirection: 'memfs-to-opfs',
		});
		expect(dispatchedActions.at(-1)).toEqual(
			mocks.updateClientInfo({
				siteSlug: 'test-site',
				changes: {
					opfsMountDescriptor: previousMountDescriptor,
					opfsSync: {
						status: 'error',
						operation: 'save',
					},
				},
			})
		);
	});

	it('keeps the previous mount descriptor when unmounting it fails', async () => {
		const previousMountDescriptor = {
			device: {
				type: 'opfs',
				path: '/sites/test-site',
			},
			mountpoint: '/wordpress',
		} as const;
		const localFsHandle = {} as FileSystemDirectoryHandle;
		const unmountError = new Error('cannot unmount current storage');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => true);
		playground.unmountOpfs = vi.fn(async () => {
			throw unmountError;
		});
		playground.mountOpfs = vi.fn();
		mocks.selectClientInfoBySiteSlug.mockReturnValue({
			client: playground,
			opfsMountDescriptor: previousMountDescriptor,
		});
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			metadata: {
				name: 'Test site',
				persistence: 'autosave',
				storage: 'opfs',
				whenCreated: 1,
				whenLastUsed: 1,
			},
		});
		const dispatchedActions: any[] = [];
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			dispatchedActions.push(action);
			return action;
		});

		await expect(
			persistTemporarySite('test-site', 'local-fs', {
				localFsHandle,
			})(dispatch as any, getState as any)
		).rejects.toThrow(unmountError);

		expect(playground.mountOpfs).not.toHaveBeenCalled();
		expect(dispatchedActions.at(-1)).toEqual(
			mocks.updateClientInfo({
				siteSlug: 'test-site',
				changes: {
					opfsMountDescriptor: previousMountDescriptor,
					opfsSync: {
						status: 'error',
						operation: 'save',
					},
				},
			})
		);
	});

	it('restores the previous mount when local-directory metadata persistence fails', async () => {
		const previousMountDescriptor = {
			device: {
				type: 'opfs',
				path: '/sites/test-site',
			},
			mountpoint: '/wordpress',
		} as const;
		const localFsHandle = {} as FileSystemDirectoryHandle;
		const metadataError = new Error('metadata write failed');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => true);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientInfoBySiteSlug.mockReturnValue({
			client: playground,
			opfsMountDescriptor: previousMountDescriptor,
		});
		mocks.selectSiteBySlug.mockReturnValue({
			slug: 'test-site',
			metadata: {
				name: 'Test site',
				persistence: 'autosave',
				storage: 'opfs',
				whenCreated: 1,
				whenLastUsed: 1,
			},
		});
		mocks.updateSite.mockReturnValueOnce(async () => {
			throw metadataError;
		});
		const dispatchedActions: any[] = [];
		const getState = () => ({});
		const dispatch: any = vi.fn((action: any) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			dispatchedActions.push(action);
			return action;
		});

		await expect(
			persistTemporarySite('test-site', 'local-fs', {
				localFsHandle,
			})(dispatch as any, getState as any)
		).rejects.toThrow(metadataError);

		expect(playground.unmountOpfs).toHaveBeenNthCalledWith(1, '/wordpress');
		expect(playground.unmountOpfs).toHaveBeenNthCalledWith(2, '/wordpress');
		expect(playground.mountOpfs).toHaveBeenNthCalledWith(
			1,
			{
				device: {
					type: 'local-fs',
					handle: localFsHandle,
				},
				mountpoint: '/wordpress',
				initialSyncDirection: 'memfs-to-opfs',
			},
			expect.any(Function)
		);
		expect(playground.mountOpfs).toHaveBeenNthCalledWith(2, {
			...previousMountDescriptor,
			initialSyncDirection: 'memfs-to-opfs',
		});
		expect(dispatchedActions.at(-1)).toEqual(
			mocks.updateClientInfo({
				siteSlug: 'test-site',
				changes: {
					opfsMountDescriptor: previousMountDescriptor,
					opfsSync: {
						status: 'error',
						operation: 'save',
					},
				},
			})
		);
	});
});

function createPlaygroundWithConstants(
	contents: string | undefined
): PlaygroundClient {
	return {
		fileExists: vi.fn(async (path: string) => {
			expect(path).toBe('/internal/shared/consts.json');
			return contents !== undefined;
		}),
		readFileAsText: vi.fn(async (path: string) => {
			expect(path).toBe('/internal/shared/consts.json');
			return contents ?? '';
		}),
	} as unknown as PlaygroundClient;
}
