// @vitest-environment jsdom

import type { PlaygroundClient } from '@wp-playground/remote';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistTemporarySite } from './persist-temporary-site';

const mocks = vi.hoisted(() => ({
	getDirectoryPathForSlug: vi.fn((slug: string) => `/sites/${slug}`),
	getSetupUrlFromSite: vi.fn(
		() => new URL('https://playground.test/?php=8.3')
	),
	getRuntimeBootFingerprint: vi.fn((runtimeConfiguration) =>
		JSON.stringify(runtimeConfiguration ?? {})
	),
	legacyOpfsPathSymbol: Symbol('legacyOpfsPath'),
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
	deletePersistedBlueprintBundleVersion: vi.fn(),
	saveDirectoryHandle: vi.fn(),
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
	commitSiteUpdateWhileLocked: vi.fn(async () => undefined),
	getAuthoritativeSiteWhileLocked: vi.fn(async (): Promise<any> => undefined),
	serializeAutosaveLifecycle: vi.fn(async (operation) => operation()),
	serializeSiteUpdate: vi.fn(async (_slug, operation) => operation()),
	acquireSiteRuntimeLock: vi.fn(async () => undefined),
	getCurrentSiteBootSignal: vi.fn<() => AbortSignal | undefined>(
		() => undefined
	),
	releaseSiteRuntimeLock: vi.fn(async () => undefined),
	abortSiteBoot: vi.fn(),
	removeClientInfo: vi.fn((siteSlug) => ({
		type: 'clients/removeClientInfo',
		payload: siteSlug,
	})),
	updateSite: vi.fn((payload) => ({
		type: 'sites/updateSite',
		payload,
	})),
}));

vi.mock('@php-wasm/logger', () => ({
	logger: {
		error: vi.fn(),
	},
}));

vi.mock('../opfs/opfs-blueprint-bundle-storage', () => ({
	deletePersistedBlueprintBundleVersion:
		mocks.deletePersistedBlueprintBundleVersion,
	isTraversableFilesystemBackend: (value: unknown) =>
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { read?: unknown }).read === 'function' &&
		typeof (value as { listFiles?: unknown }).listFiles === 'function' &&
		typeof (value as { isDir?: unknown }).isDir === 'function',
	persistBlueprintBundle: mocks.persistBlueprintBundle,
}));

vi.mock('../opfs/opfs-directory-handle-storage', () => ({
	saveDirectoryHandle: mocks.saveDirectoryHandle,
}));

vi.mock('../opfs/opfs-site-storage', () => ({
	getDirectoryPathForSlug: mocks.getDirectoryPathForSlug,
	legacyOpfsPathSymbol: mocks.legacyOpfsPathSymbol,
	get opfsSiteStorage() {
		return mocks.opfsSiteStorage;
	},
}));

vi.mock('../playground-identity', () => ({
	getRuntimeBootFingerprint: mocks.getRuntimeBootFingerprint,
	getSetupUrlFromSite: mocks.getSetupUrlFromSite,
}));

vi.mock('../site-runtime-lock', () => ({
	abortSiteBoot: mocks.abortSiteBoot,
	acquireSiteRuntimeLock: mocks.acquireSiteRuntimeLock,
	getCurrentSiteBootSignal: mocks.getCurrentSiteBootSignal,
	releaseSiteRuntimeLock: mocks.releaseSiteRuntimeLock,
}));

vi.mock('../url/router', () => ({
	PlaygroundRoute: {
		site: vi.fn(() => '/website-server/#/site/test-site'),
	},
	redirectTo: mocks.redirectTo,
}));

vi.mock('./slice-clients', () => ({
	removeClientInfo: mocks.removeClientInfo,
	selectClientBySiteSlug: mocks.selectClientBySiteSlug,
	selectClientInfoBySiteSlug: mocks.selectClientInfoBySiteSlug,
	updateClientInfo: mocks.updateClientInfo,
}));

vi.mock('./slice-sites', () => ({
	selectSiteBySlug: mocks.selectSiteBySlug,
	commitSiteUpdateWhileLocked: mocks.commitSiteUpdateWhileLocked,
	getAuthoritativeSiteWhileLocked: mocks.getAuthoritativeSiteWhileLocked,
	serializeAutosaveLifecycle: mocks.serializeAutosaveLifecycle,
	serializeSiteUpdate: mocks.serializeSiteUpdate,
	sitesSlice: {
		actions: {
			updateSite: mocks.updateSite,
		},
	},
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
		mocks.getRuntimeBootFingerprint.mockClear();
		mocks.opfsSiteStorage.create.mockReset();
		mocks.opfsSiteStorage.delete.mockReset();
		mocks.opfsSiteStorage.read.mockReset();
		mocks.persistBlueprintBundle.mockReset();
		mocks.deletePersistedBlueprintBundleVersion.mockReset();
		mocks.saveDirectoryHandle.mockReset();
		mocks.saveDirectoryHandle.mockResolvedValue(undefined);
		mocks.redirectTo.mockReset();
		mocks.selectClientBySiteSlug.mockReset();
		mocks.selectClientInfoBySiteSlug.mockReset();
		mocks.selectSiteBySlug.mockReset();
		mocks.setActiveModal.mockClear();
		mocks.updateClientInfo.mockClear();
		mocks.commitSiteUpdateWhileLocked.mockReset();
		mocks.commitSiteUpdateWhileLocked.mockResolvedValue(undefined);
		mocks.getAuthoritativeSiteWhileLocked.mockReset();
		mocks.getAuthoritativeSiteWhileLocked.mockImplementation(async () =>
			mocks.selectSiteBySlug()
		);
		mocks.serializeAutosaveLifecycle.mockClear();
		mocks.serializeSiteUpdate.mockClear();
		mocks.acquireSiteRuntimeLock.mockReset();
		mocks.acquireSiteRuntimeLock.mockResolvedValue(undefined);
		mocks.getCurrentSiteBootSignal.mockReset();
		mocks.getCurrentSiteBootSignal.mockReturnValue(undefined);
		mocks.releaseSiteRuntimeLock.mockReset();
		mocks.releaseSiteRuntimeLock.mockResolvedValue(undefined);
		mocks.abortSiteBoot.mockReset();
		mocks.removeClientInfo.mockClear();
		mocks.updateSite.mockClear();
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

	it('does not copy a persisted Blueprint bundle onto itself', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => true);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		const site = createAutosavedSiteInfo();
		site.metadata.originalBlueprint = {
			read: vi.fn(),
			listFiles: vi.fn(),
			isDir: vi.fn(),
		};
		site.metadata.originalBlueprintSource = { type: 'opfs-site' };
		mocks.selectSiteBySlug.mockReturnValue(site);

		await persistTemporarySite('test-site', 'local-fs', {
			localFsHandle: {} as FileSystemDirectoryHandle,
		})(createDispatch() as any, createEmptyGetState() as any);

		expect(mocks.persistBlueprintBundle).not.toHaveBeenCalled();
	});

	it('does not mount or commit when the Blueprint bundle copy fails', async () => {
		const bundleCopyError = new Error('bundle copy failed');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		const site = createTemporarySiteInfo();
		site.metadata.originalBlueprint = {
			read: vi.fn(),
			listFiles: vi.fn(),
			isDir: vi.fn(),
		};
		mocks.selectSiteBySlug.mockReturnValue(site);
		mocks.persistBlueprintBundle.mockRejectedValue(bundleCopyError);

		await expect(
			persistTemporarySite('test-site', 'opfs')(
				createDispatch() as any,
				createEmptyGetState() as any
			)
		).rejects.toBe(bundleCopyError);

		expect(playground.mountOpfs).not.toHaveBeenCalled();
		expect(mocks.acquireSiteRuntimeLock).not.toHaveBeenCalled();
		expect(mocks.commitSiteUpdateWhileLocked).not.toHaveBeenCalled();
	});

	it('does not stage a bundle before local directory selection succeeds', async () => {
		const selectionError = new Error('directory selection failed');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		const site = createTemporarySiteInfo();
		site.metadata.originalBlueprint = {
			read: vi.fn(),
			listFiles: vi.fn(),
			isDir: vi.fn(),
		};
		mocks.selectSiteBySlug.mockReturnValue(site);
		mocks.saveDirectoryHandle.mockRejectedValueOnce(selectionError);

		await expect(
			persistTemporarySite('test-site', 'local-fs', {
				localFsHandle: {} as FileSystemDirectoryHandle,
			})(createDispatch() as any, createEmptyGetState() as any)
		).rejects.toBe(selectionError);

		expect(mocks.persistBlueprintBundle).not.toHaveBeenCalled();
		expect(playground.mountOpfs).not.toHaveBeenCalled();
	});

	it('does not turn an explicitly saved site back into an autosave', async () => {
		const site = createAutosavedSiteInfo();
		site.metadata.persistence = 'explicit';
		mocks.selectClientBySiteSlug.mockReturnValue(
			createPlaygroundWithConstants('{}')
		);
		mocks.selectSiteBySlug.mockReturnValue(site);

		await persistTemporarySite('test-site', 'opfs', {
			persistence: 'autosave',
		})(createDispatch() as any, createEmptyGetState() as any);

		expect(mocks.acquireSiteRuntimeLock).not.toHaveBeenCalled();
		expect(mocks.commitSiteUpdateWhileLocked).not.toHaveBeenCalled();
	});

	it('refuses to save files from a stale authoritative setup', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		const localSite = createTemporarySiteInfo();
		mocks.selectSiteBySlug.mockReturnValue(localSite);
		mocks.getAuthoritativeSiteWhileLocked.mockResolvedValue({
			...localSite,
			metadata: {
				...localSite.metadata,
				runtimeConfiguration: { phpVersion: '8.4' },
			},
		});

		await expect(
			persistTemporarySite('test-site', 'opfs')(
				createDispatch() as any,
				createEmptyGetState() as any
			)
		).rejects.toThrow(
			'Cannot save test-site; its active Playground setup changed.'
		);

		expect(playground.mountOpfs).not.toHaveBeenCalled();
		expect(mocks.commitSiteUpdateWhileLocked).not.toHaveBeenCalled();
	});

	it('refuses to save after the active client changes', async () => {
		const originalPlayground = createPlaygroundWithConstants('{}') as any;
		originalPlayground.hasOpfsMount = vi.fn(async () => false);
		originalPlayground.mountOpfs = vi.fn(async () => undefined);
		const replacementPlayground = createPlaygroundWithConstants('{}');
		mocks.selectClientBySiteSlug
			.mockReturnValueOnce(originalPlayground)
			.mockReturnValue(replacementPlayground);
		mocks.selectSiteBySlug.mockReturnValue(createTemporarySiteInfo());

		await expect(
			persistTemporarySite('test-site', 'opfs')(
				createDispatch() as any,
				createEmptyGetState() as any
			)
		).rejects.toThrow(
			'Cannot save test-site; its active Playground setup changed.'
		);

		expect(originalPlayground.mountOpfs).not.toHaveBeenCalled();
		expect(mocks.commitSiteUpdateWhileLocked).not.toHaveBeenCalled();
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
		mocks.commitSiteUpdateWhileLocked.mockImplementation(async () => {
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
		expect(mocks.commitSiteUpdateWhileLocked).toHaveBeenCalledWith(
			{
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
			},
			expect.any(Function),
			expect.any(Function)
		);
	});

	it('reboots a replacement that started before the save commit finished', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		const replacementClient = createPlaygroundWithConstants('{}') as any;
		const originalBoot = new AbortController();
		const replacementBoot = new AbortController();
		mocks.getCurrentSiteBootSignal.mockReturnValue(originalBoot.signal);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		const temporarySite = createTemporarySiteInfo();
		mocks.selectSiteBySlug.mockReturnValue(temporarySite);
		let finishCommit = () => {};
		const generationWriteError = new Error(
			'recovery generation write failed'
		);
		mocks.commitSiteUpdateWhileLocked.mockImplementationOnce(
			() =>
				new Promise<undefined>((resolve) => {
					finishCommit = () => resolve(undefined);
				})
		);
		mocks.commitSiteUpdateWhileLocked.mockRejectedValueOnce(
			generationWriteError
		);

		const persistence = persistTemporarySite('test-site', 'opfs', {
			persistence: 'autosave',
		})(createDispatch() as any, createEmptyGetState() as any);
		await vi.waitFor(() => {
			expect(mocks.commitSiteUpdateWhileLocked).toHaveBeenCalled();
		});
		mocks.selectClientBySiteSlug.mockReturnValue(replacementClient);
		mocks.getCurrentSiteBootSignal.mockReturnValue(replacementBoot.signal);
		mocks.selectSiteBySlug.mockReturnValue({
			...temporarySite,
			metadata: {
				...temporarySite.metadata,
				storage: 'opfs',
				persistence: 'autosave',
			},
		});
		finishCommit();
		await persistence;

		expect(mocks.abortSiteBoot).toHaveBeenCalledWith('test-site');
		expect(mocks.removeClientInfo).toHaveBeenCalledWith('test-site');
		expect(mocks.releaseSiteRuntimeLock).toHaveBeenCalledWith(
			replacementBoot.signal
		);
		expect(mocks.commitSiteUpdateWhileLocked).toHaveBeenCalledTimes(2);
		expect(mocks.commitSiteUpdateWhileLocked).toHaveBeenLastCalledWith(
			expect.objectContaining({
				slug: 'test-site',
				changes: {
					metadata: {
						whenCreated: expect.any(Number),
					},
				},
			}),
			expect.any(Function),
			expect.any(Function)
		);
		expect(mocks.updateSite).toHaveBeenCalledWith({
			id: 'test-site',
			changes: {
				metadata: expect.objectContaining({
					persistence: 'autosave',
					whenCreated: expect.any(Number),
				}),
			},
		});
		expect(mocks.updateClientInfo).not.toHaveBeenCalledWith(
			expect.objectContaining({
				changes: expect.objectContaining({
					opfsMountDescriptor: expect.anything(),
				}),
			})
		);
	});

	it('does not mount stale client files after bundle persistence waits', async () => {
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		const replacementClient = createPlaygroundWithConstants('{}') as any;
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		const site = createTemporarySiteInfo();
		site.metadata.originalBlueprint = {
			read: vi.fn(),
			listFiles: vi.fn(),
			isDir: vi.fn(),
		};
		mocks.selectSiteBySlug.mockReturnValue(site);
		let finishBundleCopy = () => {};
		mocks.persistBlueprintBundle.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishBundleCopy = () =>
						resolve({
							directory: 'blueprint-bundle-version',
							backend: {},
						});
				})
		);

		const persistence = persistTemporarySite('test-site', 'local-fs', {
			localFsHandle: {} as FileSystemDirectoryHandle,
		})(createDispatch() as any, createEmptyGetState() as any);
		await vi.waitFor(() => {
			expect(mocks.persistBlueprintBundle).toHaveBeenCalled();
		});
		mocks.selectClientBySiteSlug.mockReturnValue(replacementClient);
		finishBundleCopy();

		await expect(persistence).rejects.toThrow(
			'active Playground changed while the Blueprint bundle was copied'
		);
		expect(playground.mountOpfs).not.toHaveBeenCalled();
		expect(
			mocks.deletePersistedBlueprintBundleVersion
		).toHaveBeenCalledWith(
			'test-site',
			'blueprint-bundle-version',
			undefined
		);
	});

	it('does not update the site when the durable file mount fails', async () => {
		const mountError = new Error('mount failed');
		const bootSignal = new AbortController().signal;
		mocks.getCurrentSiteBootSignal.mockReturnValue(bootSignal);
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

		expect(mocks.commitSiteUpdateWhileLocked).not.toHaveBeenCalled();
		expect(mocks.releaseSiteRuntimeLock).toHaveBeenCalledWith(bootSignal);
	});

	it('detaches a newly mounted OPFS backend and releases its lease when metadata fails', async () => {
		const metadataError = new Error('metadata write failed');
		const bootSignal = new AbortController().signal;
		mocks.getCurrentSiteBootSignal.mockReturnValue(bootSignal);
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => false);
		playground.unmountOpfs = vi.fn(async () => undefined);
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientBySiteSlug.mockReturnValue(playground);
		mocks.selectSiteBySlug.mockReturnValue(createTemporarySiteInfo());
		mocks.commitSiteUpdateWhileLocked.mockRejectedValue(metadataError);
		const dispatchedActions: any[] = [];

		await expect(
			persistTemporarySite('test-site', 'opfs')(
				createDispatch(dispatchedActions) as any,
				createEmptyGetState() as any
			)
		).rejects.toBe(metadataError);

		expect(mocks.acquireSiteRuntimeLock).toHaveBeenCalledWith(
			'test-site',
			bootSignal
		);
		expect(playground.unmountOpfs).toHaveBeenCalledWith('/wordpress');
		expect(mocks.releaseSiteRuntimeLock).toHaveBeenCalledWith(bootSignal);
		expect(dispatchedActions.at(-1)).toEqual(
			mocks.updateClientInfo({
				siteSlug: 'test-site',
				changes: {
					opfsMountDescriptor: undefined,
					opfsSync: {
						status: 'error',
						operation: 'save',
					},
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
			initialSyncDirection: 'opfs-to-memfs',
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

	it('keeps the previous mount when its final unmount flush fails', async () => {
		const previousMountDescriptor = {
			device: {
				type: 'opfs',
				path: '/sites/test-site',
			},
			mountpoint: '/wordpress',
		} as const;
		const finalFlushError = new Error('final OPFS flush failed');
		const playground = createPlaygroundWithConstants('{}') as any;
		playground.hasOpfsMount = vi.fn(async () => true);
		playground.unmountOpfs = vi.fn(async () => {
			throw finalFlushError;
		});
		playground.mountOpfs = vi.fn(async () => undefined);
		mocks.selectClientInfoBySiteSlug.mockReturnValue({
			client: playground,
			opfsMountDescriptor: previousMountDescriptor,
		});
		mocks.selectSiteBySlug.mockReturnValue(createAutosavedSiteInfo());
		const dispatchedActions: any[] = [];

		await expect(
			persistTemporarySite('test-site', 'local-fs', {
				localFsHandle: {} as FileSystemDirectoryHandle,
			})(
				createDispatch(dispatchedActions) as any,
				createEmptyGetState() as any
			)
		).rejects.toBe(finalFlushError);

		expect(playground.flushOpfs).toHaveBeenCalledWith('/wordpress');
		expect(playground.unmountOpfs).toHaveBeenCalledWith('/wordpress');
		expect(playground.mountOpfs).not.toHaveBeenCalled();
		expect(mocks.commitSiteUpdateWhileLocked).not.toHaveBeenCalled();
		expect(mocks.releaseSiteRuntimeLock).not.toHaveBeenCalled();
		expect(dispatchedActions.at(-1)).toEqual(
			mocks.updateClientInfo({
				siteSlug: 'test-site',
				changes: {
					opfsMountDescriptor: previousMountDescriptor,
					opfsSync: { status: 'error', operation: 'save' },
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
		mocks.commitSiteUpdateWhileLocked.mockImplementationOnce(async () => {
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
			initialSyncDirection: 'opfs-to-memfs',
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
		flushOpfs: vi.fn(async () => undefined),
		readFileAsText: vi.fn(async (path: string) => {
			expect(path).toBe('/internal/shared/consts.json');
			if (contents === undefined) {
				throw new Error('File not found');
			}
			return contents;
		}),
	} as unknown as PlaygroundClient;
}
