// @vitest-environment jsdom

import type { PlaygroundClient } from '@wp-playground/remote';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistTemporarySite } from './persist-temporary-site';

const mocks = vi.hoisted(() => ({
	getDirectoryPathForSlug: vi.fn((slug: string) => `/sites/${slug}`),
	getSetupUrlFromSite: vi.fn(
		() => new URL('https://playground.test/?php=8.3')
	),
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
	persistBlueprintBundle: vi.fn(),
	redirectTo: vi.fn(),
	selectClientBySiteSlug: vi.fn(),
	selectClientInfoBySiteSlug: vi.fn(),
	selectSiteBySlug: vi.fn(),
	setActiveModal: vi.fn((modal) => ({
		type: 'ui/setActiveModal',
		payload: modal,
	})),
	updateClientInfo: vi.fn((payload) => ({
		type: 'clients/updateClientInfo',
		payload,
	})),
	updateSite: vi.fn(() => async () => undefined),
}));

vi.mock('@php-wasm/logger', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

vi.mock('../opfs/opfs-blueprint-bundle-storage', () => ({
	isTraversableFilesystemBackend: (value: unknown) =>
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { read?: unknown }).read === 'function' &&
		typeof (value as { listFiles?: unknown }).listFiles === 'function' &&
		typeof (value as { isDir?: unknown }).isDir === 'function',
	persistBlueprintBundle: mocks.persistBlueprintBundle,
}));

vi.mock('../opfs/opfs-directory-handle-storage', () => ({
	saveDirectoryHandle: vi.fn(),
}));

vi.mock('../opfs/opfs-site-storage', () => ({
	getDirectoryPathForSlug: mocks.getDirectoryPathForSlug,
	get opfsSiteStorage() {
		return mocks.opfsSiteStorage;
	},
}));

vi.mock('../playground-identity', () => ({
	getSetupUrlFromSite: mocks.getSetupUrlFromSite,
}));

vi.mock('../url/router', () => ({
	PlaygroundRoute: {
		site: vi.fn(() => '/website-server/#/site/test-site'),
	},
	redirectTo: mocks.redirectTo,
}));

vi.mock('./slice-clients', () => ({
	selectClientBySiteSlug: mocks.selectClientBySiteSlug,
	selectClientInfoBySiteSlug: mocks.selectClientInfoBySiteSlug,
	updateClientInfo: mocks.updateClientInfo,
}));

vi.mock('./slice-sites', () => ({
	selectSiteBySlug: mocks.selectSiteBySlug,
	updateSite: mocks.updateSite,
}));

vi.mock('./slice-ui', () => ({
	setActiveModal: mocks.setActiveModal,
}));

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
		mocks.getSetupUrlFromSite.mockReset();
		mocks.getSetupUrlFromSite.mockReturnValue(
			new URL('https://playground.test/?php=8.3')
		);
		mocks.opfsSiteStorage.create.mockReset();
		mocks.opfsSiteStorage.delete.mockReset();
		mocks.opfsSiteStorage.read.mockReset();
		mocks.persistBlueprintBundle.mockReset();
		mocks.redirectTo.mockReset();
		mocks.selectClientBySiteSlug.mockReset();
		mocks.selectClientInfoBySiteSlug.mockReset();
		mocks.selectSiteBySlug.mockReset();
		mocks.setActiveModal.mockClear();
		mocks.updateClientInfo.mockClear();
		mocks.updateSite.mockReset();
		mocks.updateSite.mockReturnValue(async () => undefined);
	});

	it('keeps a pending OPFS save record when this runtime uses its directory', async () => {
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
		mocks.selectSiteBySlug.mockReturnValue(createTemporarySiteInfo());

		await persistTemporarySite('test-site', 'opfs')(
			createDispatch() as any,
			createEmptyGetState() as any
		);

		expect(mocks.opfsSiteStorage.delete).not.toHaveBeenCalled();
		expect(mocks.opfsSiteStorage.create).not.toHaveBeenCalled();
		expect(playground.unmountOpfs).toHaveBeenCalledWith('/wordpress');
	});

	it('deletes a stale pending OPFS save record before retrying', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn();
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.opfsSiteStorage.read.mockResolvedValue({
			metadata: { storage: 'none' },
		});
		mocks.selectSiteBySlug.mockReturnValue(createTemporarySiteInfo());

		await persistTemporarySite('test-site', 'opfs')(
			createDispatch() as any,
			createEmptyGetState() as any
		);

		expect(mocks.opfsSiteStorage.delete).toHaveBeenCalledWith('test-site');
		expect(mocks.opfsSiteStorage.create).toHaveBeenCalled();
	});

	it('updates the site only after files are mounted into durable storage', async () => {
		const order: string[] = [];
		const playground = createPlaygroundWithConstants(
			JSON.stringify({ WP_DEBUG: true })
		) as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn();
		playground.mountOpfs = vi.fn(async () => {
			order.push('mount');
		});
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.selectSiteBySlug.mockReturnValue(
			createTemporarySiteInfo({
				originalUrlParams: {
					searchParams: {
						language: 'pl_PL',
						plugin: ['akismet', 'gutenberg'],
					},
					hash: '#blueprint',
				},
			})
		);
		mocks.getSetupUrlFromSite.mockReturnValue(
			new URL(
				'https://playground.test/?language=pl_PL&plugin=akismet&plugin=gutenberg#blueprint'
			)
		);
		mocks.updateSite.mockReturnValue(async () => {
			order.push('updateSite');
		});

		await persistTemporarySite('test-site', 'opfs')(
			createDispatch() as any,
			createEmptyGetState() as any
		);

		expect(order).toEqual(['mount', 'updateSite']);
		expect(mocks.opfsSiteStorage.create).toHaveBeenCalledWith(
			'test-site',
			expect.objectContaining({ storage: 'none' }),
			{
				searchParams: {
					language: 'pl_PL',
					plugin: ['akismet', 'gutenberg'],
				},
				hash: '#blueprint',
			}
		);
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

	it('does not update the site when the durable file mount fails', async () => {
		const mountError = new Error('mount failed');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn();
		playground.mountOpfs = vi.fn(async () => {
			throw mountError;
		});
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.selectSiteBySlug.mockReturnValue(createTemporarySiteInfo());

		await expect(
			persistTemporarySite('test-site', 'opfs')(
				createDispatch() as any,
				createEmptyGetState() as any
			)
		).rejects.toThrow(mountError);

		expect(mocks.updateSite).not.toHaveBeenCalled();
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
		mocks.selectSiteBySlug.mockReturnValue(createAutosavedSiteInfo());
		const dispatchedActions: any[] = [];

		await expect(
			persistTemporarySite('test-site', 'local-fs', {
				localFsHandle,
			})(
				createDispatch(dispatchedActions) as any,
				createEmptyGetState() as any
			)
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
		mocks.selectSiteBySlug.mockReturnValue(createAutosavedSiteInfo());
		mocks.updateSite.mockReturnValueOnce(async () => {
			throw metadataError;
		});
		const dispatchedActions: any[] = [];

		await expect(
			persistTemporarySite('test-site', 'local-fs', {
				localFsHandle,
			})(
				createDispatch(dispatchedActions) as any,
				createEmptyGetState() as any
			)
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

function createTemporarySiteInfo({
	originalUrlParams,
}: {
	originalUrlParams?: {
		searchParams?: Record<string, string | string[]>;
		hash?: string;
	};
} = {}) {
	return {
		slug: 'test-site',
		originalUrlParams,
		metadata: {
			id: 'test-site-id',
			name: 'Test site',
			storage: 'none',
			runtimeConfiguration: {},
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' },
		},
	};
}

function createAutosavedSiteInfo() {
	return {
		slug: 'test-site',
		metadata: {
			id: 'test-site-id',
			name: 'Test site',
			persistence: 'autosave',
			storage: 'opfs',
			whenCreated: 1,
			whenLastUsed: 1,
			runtimeConfiguration: {},
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' },
		},
	};
}

function createEmptyGetState() {
	return () => ({});
}

function createDispatch(
	dispatchedActions: any[] = []
): ReturnType<typeof vi.fn> {
	const dispatch: ReturnType<typeof vi.fn> = vi.fn((action: any) => {
		if (typeof action === 'function') {
			return action(dispatch, createEmptyGetState());
		}
		dispatchedActions.push(action);
		return action;
	});
	return dispatch;
}

function createPlaygroundWithConstants(contents: string | undefined) {
	return {
		fileExists: vi.fn(async () => contents !== undefined),
		readFileAsText: vi.fn(async (path: string) => {
			expect(path).toBe('/internal/shared/consts.json');
			if (contents === undefined) {
				throw new Error('File not found');
			}
			return contents;
		}),
	} as unknown as PlaygroundClient;
}
