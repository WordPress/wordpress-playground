import type { OriginalUrlParams } from '../original-url-params';
import type { SiteInfo } from './slice-sites';

const durableSitesForTest = new Map<string, SiteInfo>();

describe('stored site specs', () => {
	let createSite: ReturnType<typeof vi.fn>;
	let deleteSite: ReturnType<typeof vi.fn>;
	let updateSiteStorage: ReturnType<typeof vi.fn>;
	let readSiteStorage: ReturnType<typeof vi.fn>;
	let listSitesStorage: ReturnType<typeof vi.fn>;
	let loadPersistedBlueprintBundle: ReturnType<typeof vi.fn>;
	let persistBlueprintBundle: ReturnType<typeof vi.fn>;
	let deletePersistedBlueprintBundleVersion: ReturnType<typeof vi.fn>;
	let removeUnownedSiteDirectory: ReturnType<typeof vi.fn>;
	let removeWordPressFilesKeepMetadata: ReturnType<typeof vi.fn>;
	let resolveRuntimeConfiguration: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		durableSitesForTest.clear();
		createSite = vi.fn(async (slug, metadata, originalUrlParams) => {
			durableSitesForTest.set(slug, {
				slug,
				metadata,
				originalUrlParams,
			});
		});
		deleteSite = vi.fn(async (slug) => {
			durableSitesForTest.delete(slug);
		});
		updateSiteStorage = vi.fn(async (slug, metadata, originalUrlParams) => {
			durableSitesForTest.set(slug, {
				slug,
				metadata,
				originalUrlParams,
			});
		});
		readSiteStorage = vi.fn(async (slug) => durableSitesForTest.get(slug));
		listSitesStorage = vi.fn(async () =>
			Array.from(durableSitesForTest.values())
		);
		loadPersistedBlueprintBundle = vi.fn(async () => ({
			persisted: true,
		}));
		persistBlueprintBundle = vi.fn(async () => ({
			directory: 'blueprint-bundle-version',
			backend: { persisted: true },
		}));
		deletePersistedBlueprintBundleVersion = vi.fn();
		removeUnownedSiteDirectory = vi.fn();
		removeWordPressFilesKeepMetadata = vi.fn();
		resolveRuntimeConfiguration = vi.fn();

		vi.doMock('@php-wasm/logger', () => ({
			logger: {
				error: vi.fn(),
			},
		}));
		vi.doMock('@wp-playground/common', () => ({
			RecommendedPHPVersion: '8.3',
		}));
		vi.doMock('@wp-playground/blueprints', () => ({
			BlueprintFetchError: class BlueprintFetchError extends Error {},
			BlueprintReflection: {
				create: vi.fn(async () => ({
					getVersion: () => 2,
				})),
			},
			InvalidBlueprintError: class InvalidBlueprintError extends Error {},
			resolveRuntimeConfiguration,
		}));
		vi.doMock('../opfs/opfs-blueprint-bundle-storage', () => ({
			deletePersistedBlueprintBundleVersion,
			isTraversableFilesystemBackend: (value: unknown) =>
				typeof value === 'object' &&
				value !== null &&
				typeof (value as { read?: unknown }).read === 'function' &&
				typeof (value as { listFiles?: unknown }).listFiles ===
					'function' &&
				typeof (value as { isDir?: unknown }).isDir === 'function',
			loadPersistedBlueprintBundle,
			persistBlueprintBundle,
		}));
		vi.doMock('../opfs/opfs-site-storage', () => ({
			blueprintBundleLoadErrorSymbol: Symbol('blueprintBundleLoadError'),
			legacyOpfsPathSymbol: Symbol('legacyOpfsPath'),
			opfsSiteStorage: {
				create: createSite,
				delete: deleteSite,
				list: listSitesStorage,
				read: readSiteStorage,
				update: updateSiteStorage,
				removeWordPressFilesKeepMetadata,
				removeUnownedSiteDirectory,
			},
		}));
		vi.doMock('../playground-identity', () => ({
			getAutosaveFingerprintFromURL: () => 'fingerprint',
			getRuntimeBootFingerprint: (runtimeConfiguration: unknown) =>
				JSON.stringify(runtimeConfiguration),
		}));
		vi.doMock('../url/resolve-blueprint-from-url', () => ({
			applyQueryOverrides: vi.fn(),
			resolveBlueprintFromURL: vi.fn(async () => ({
				blueprint: createBundleBlueprint(),
				source: { type: 'inline-string' },
			})),
		}));
		vi.doMock('./slice-ui', () => ({
			setActiveSiteError: vi.fn((payload) => ({
				type: 'ui/setActiveSiteError',
				payload,
			})),
		}));
		vi.doMock('./store', () => ({
			selectActiveSite: vi.fn(),
			setActiveSite: vi.fn((slug) => ({
				type: 'ui/setActiveSite',
				payload: slug,
			})),
		}));
	});

	afterEach(() => {
		vi.doUnmock('@php-wasm/logger');
		vi.doUnmock('@wp-playground/common');
		vi.doUnmock('@wp-playground/blueprints');
		vi.doUnmock('../opfs/opfs-blueprint-bundle-storage');
		vi.doUnmock('../opfs/opfs-site-storage');
		vi.doUnmock('../site-runtime-lock');
		vi.doUnmock('../playground-identity');
		vi.doUnmock('../url/resolve-blueprint-from-url');
		vi.doUnmock('./slice-ui');
		vi.doUnmock('./store');
	});

	it('persists setup URL params when adding a saved site', async () => {
		const { addSite } = await import('./slice-sites');
		const originalUrlParams = {
			searchParams: {
				language: 'pl_PL',
				plugin: ['akismet', 'gutenberg'],
			},
			hash: '#blueprint',
		};
		const site = createSiteInfo({
			originalUrlParams,
		});

		await addSite(site)(
			createDispatch() as any,
			createEmptyGetState() as any
		);

		expect(createSite).toHaveBeenCalledWith(
			site.slug,
			site.metadata,
			originalUrlParams
		);
	});

	it('keeps setup URL params when updating persisted metadata', async () => {
		const { sitesSlice, updateSite } = await import('./slice-sites');
		const originalUrlParams = {
			searchParams: {
				language: 'pl_PL',
				multisite: 'yes',
			},
		};
		const site = createSiteInfo({
			originalUrlParams,
		});
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		const updatedMetadata = {
			...site.metadata,
			name: 'Renamed Playground',
		};

		await updateSite({
			slug: site.slug,
			changes: {
				metadata: updatedMetadata,
			},
		})(dispatch as any, () => state as any);

		expect(updateSiteStorage).toHaveBeenCalledWith(
			site.slug,
			updatedMetadata,
			originalUrlParams
		);
	});

	it('updates redux only after persisted metadata is written', async () => {
		const { sitesSlice, updateSite } = await import('./slice-sites');
		const site = createSiteInfo();
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const order: string[] = [];
		updateSiteStorage.mockImplementation(async () => {
			order.push('opfs');
		});
		const dispatch = vi.fn((action) => {
			order.push('redux');
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		const updatedMetadata = {
			...site.metadata,
			name: 'Renamed Playground',
		};

		await updateSite({
			slug: site.slug,
			changes: {
				metadata: updatedMetadata,
			},
		})(dispatch as any, () => state as any);

		expect(order).toEqual(['opfs', 'redux']);
	});

	it('does not update redux when persisted metadata write fails', async () => {
		const storageError = new Error('metadata write failed');
		updateSiteStorage.mockRejectedValue(storageError);
		const { sitesSlice, updateSite } = await import('./slice-sites');
		const site = createSiteInfo();
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state.sites = sitesSlice.reducer(state.sites, action);
			return action;
		});
		const updatedMetadata = {
			...site.metadata,
			name: 'Renamed Playground',
		};

		await expect(
			updateSite({
				slug: site.slug,
				changes: {
					metadata: updatedMetadata,
				},
			})(dispatch as any, () => state as any)
		).rejects.toThrow(storageError);

		expect(dispatch).not.toHaveBeenCalled();
		expect(state.sites.entities[site.slug]?.metadata.name).toBe(
			'Stored site'
		);
	});

	it('keeps durable setup metadata authoritative over a local-only update', async () => {
		const { persistBlueprintBundleForSetup, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.whenCreated = 1;
		site.metadata.persistence = 'autosave';
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		let releaseStaleWrite = () => {};
		const staleWrite = new Promise<void>((resolve) => {
			releaseStaleWrite = resolve;
		});
		updateSiteStorage.mockImplementationOnce(() => staleWrite);

		const promotion = persistBlueprintBundleForSetup({
			slug: site.slug,
			expectedSetup: {
				id: site.metadata.id,
				whenCreated: 1,
				runtimeConfiguration: site.metadata.runtimeConfiguration,
				sourceSetupUrlFingerprint: undefined,
			},
			source: createBundleBlueprint(),
		})(dispatch as any, () => state as any);
		await vi.waitFor(() => {
			expect(updateSiteStorage).toHaveBeenCalledTimes(1);
		});

		const newerMetadata = {
			...site.metadata,
			whenCreated: 2,
			name: 'New setup',
		};
		dispatch(
			sitesSlice.actions.updateSite({
				id: site.slug,
				changes: { metadata: newerMetadata },
			})
		);
		releaseStaleWrite();

		await expect(promotion).resolves.toEqual({ persisted: true });
		expect(updateSiteStorage).toHaveBeenCalledOnce();
		expect(state.sites.entities[site.slug]?.metadata).toEqual({
			...site.metadata,
			originalBlueprint: { persisted: true },
			originalBlueprintSource: {
				type: 'opfs-site',
				directory: 'blueprint-bundle-version',
			},
		});
	});

	it('removes an inactive bundle when its metadata promotion fails', async () => {
		const { persistBlueprintBundleForSetup, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		durableSitesForTest.set(site.slug, site);
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const writeError = new Error('metadata write failed');
		updateSiteStorage.mockRejectedValueOnce(writeError);

		await expect(
			persistBlueprintBundleForSetup({
				slug: site.slug,
				expectedSetup: {
					id: site.metadata.id,
					whenCreated: site.metadata.whenCreated,
					runtimeConfiguration: site.metadata.runtimeConfiguration,
					sourceSetupUrlFingerprint:
						site.metadata.sourceSetupUrlFingerprint,
				},
				source: createBundleBlueprint(),
			})(vi.fn() as any, () => state as any)
		).rejects.toBe(writeError);

		expect(deletePersistedBlueprintBundleVersion).toHaveBeenCalledWith(
			site.slug,
			'blueprint-bundle-version',
			undefined
		);
	});

	it('removes a copied bundle when the pre-commit owner read fails', async () => {
		const { persistBlueprintBundleForSetup, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		const readError = new Error('authoritative read failed');
		readSiteStorage
			.mockResolvedValueOnce(site)
			.mockRejectedValueOnce(readError);
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};

		await expect(
			persistBlueprintBundleForSetup({
				slug: site.slug,
				expectedSetup: {
					id: site.metadata.id,
					whenCreated: site.metadata.whenCreated,
					runtimeConfiguration: site.metadata.runtimeConfiguration,
					sourceSetupUrlFingerprint:
						site.metadata.sourceSetupUrlFingerprint,
				},
				source: createBundleBlueprint(),
			})(vi.fn() as any, () => state as any)
		).rejects.toThrow('Cannot read saved Playground');

		expect(deletePersistedBlueprintBundleVersion).toHaveBeenCalledWith(
			site.slug,
			'blueprint-bundle-version',
			undefined
		);
	});

	it('serializes ordinary metadata writes and bundle promotion', async () => {
		const { persistBlueprintBundleForSetup, sitesSlice, updateSite } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		let releaseFirstWrite = () => {};
		const firstWrite = new Promise<void>((resolve) => {
			releaseFirstWrite = resolve;
		});
		updateSiteStorage.mockImplementationOnce(
			async (slug, metadata, originalUrlParams) => {
				await firstWrite;
				durableSitesForTest.set(slug, {
					slug,
					metadata,
					originalUrlParams,
				});
			}
		);

		const ordinaryUpdate = updateSite({
			slug: site.slug,
			changes: {
				metadata: { whenLastUsed: 2, persistence: 'explicit' },
			},
		})(dispatch as any, () => state as any);
		await vi.waitFor(() => {
			expect(updateSiteStorage).toHaveBeenCalledTimes(1);
		});

		const promotion = persistBlueprintBundleForSetup({
			slug: site.slug,
			expectedSetup: {
				id: site.metadata.id,
				whenCreated: undefined,
				runtimeConfiguration: site.metadata.runtimeConfiguration,
				sourceSetupUrlFingerprint: undefined,
			},
			source: createBundleBlueprint(),
		})(dispatch as any, () => state as any);
		await Promise.resolve();
		expect(updateSiteStorage).toHaveBeenCalledTimes(1);

		releaseFirstWrite();
		await Promise.all([ordinaryUpdate, promotion]);

		expect(updateSiteStorage).toHaveBeenCalledTimes(2);
		expect(updateSiteStorage).toHaveBeenLastCalledWith(
			site.slug,
			expect.objectContaining({
				whenLastUsed: 2,
				persistence: 'explicit',
				originalBlueprint: { persisted: true },
				originalBlueprintSource: {
					type: 'opfs-site',
					directory: 'blueprint-bundle-version',
				},
			}),
			undefined
		);
		expect(state.sites.entities[site.slug]?.metadata).toEqual({
			...site.metadata,
			whenLastUsed: 2,
			persistence: 'explicit',
			originalBlueprint: { persisted: true },
			originalBlueprintSource: {
				type: 'opfs-site',
				directory: 'blueprint-bundle-version',
			},
		});
	});

	it('rejects stale promotion after a queued setup replacement', async () => {
		const {
			persistBlueprintBundleForSetup,
			replaceAutosavedSiteSetup,
			sitesSlice,
		} = await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.whenCreated = 1;
		site.metadata.persistence = 'autosave';
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		let releaseFileReset = () => {};
		const fileReset = new Promise<void>((resolve) => {
			releaseFileReset = resolve;
		});
		removeWordPressFilesKeepMetadata.mockImplementationOnce(
			() => fileReset
		);

		const replacement = replaceAutosavedSiteSetup({
			slug: site.slug,
			expectedSetup: {
				id: site.metadata.id,
				whenCreated: 1,
				runtimeConfiguration: site.metadata.runtimeConfiguration,
				sourceSetupUrlFingerprint: undefined,
			},
			changes: {
				metadata: {
					whenCreated: 2,
					originalBlueprint: { replacement: true },
				},
				originalUrlParams: undefined,
			},
		})(dispatch as any, () => state as any);
		await vi.waitFor(() => {
			expect(removeWordPressFilesKeepMetadata).toHaveBeenCalledTimes(1);
		});

		const stalePromotion = persistBlueprintBundleForSetup({
			slug: site.slug,
			expectedSetup: {
				id: site.metadata.id,
				whenCreated: 1,
				runtimeConfiguration: site.metadata.runtimeConfiguration,
				sourceSetupUrlFingerprint: undefined,
			},
			source: createBundleBlueprint(),
		})(dispatch as any, () => state as any);
		await Promise.resolve();
		expect(persistBlueprintBundle).not.toHaveBeenCalled();

		releaseFileReset();
		await expect(replacement).resolves.toBe(true);
		await expect(stalePromotion).resolves.toBeNull();

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
		expect(state.sites.entities[site.slug]?.metadata).toEqual({
			...site.metadata,
			whenCreated: 2,
			originalBlueprint: { replacement: true },
			opfsSiteRemovalPending: undefined,
		});
	});

	it('does not reset a site preserved while replacement was waiting', async () => {
		const { replaceAutosavedSiteSetup, sitesSlice, updateSite } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		let releasePreserve = () => {};
		const preserveWrite = new Promise<void>((resolve) => {
			releasePreserve = resolve;
		});
		updateSiteStorage.mockImplementationOnce(
			async (slug, metadata, originalUrlParams) => {
				await preserveWrite;
				durableSitesForTest.set(slug, {
					slug,
					metadata,
					originalUrlParams,
				});
			}
		);

		const preserve = updateSite({
			slug: site.slug,
			changes: { metadata: { persistence: 'explicit' } },
		})(dispatch as any, () => state as any);
		await vi.waitFor(() => {
			expect(updateSiteStorage).toHaveBeenCalledTimes(1);
		});
		const prepareForWordPressFileReset = vi.fn();
		const replacement = replaceAutosavedSiteSetup({
			slug: site.slug,
			expectedSetup: {
				id: site.metadata.id,
				whenCreated: undefined,
				runtimeConfiguration: site.metadata.runtimeConfiguration,
				sourceSetupUrlFingerprint: undefined,
			},
			changes: {
				metadata: { whenCreated: 2 },
				originalUrlParams: undefined,
			},
			prepareForWordPressFileReset,
		})(dispatch as any, () => state as any);

		releasePreserve();
		await preserve;
		await expect(replacement).resolves.toBe(false);

		expect(prepareForWordPressFileReset).not.toHaveBeenCalled();
		expect(removeWordPressFilesKeepMetadata).not.toHaveBeenCalled();
		expect(state.sites.entities[site.slug]?.metadata.persistence).toBe(
			'explicit'
		);
	});

	it('does not replace a temporary setup after its save commits', async () => {
		const { replaceTemporarySiteSetup, serializeSiteUpdate, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.storage = 'none';
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		let releaseSave = () => {};
		const saveGate = new Promise<void>((resolve) => {
			releaseSave = resolve;
		});
		const save = serializeSiteUpdate(site.slug, async () => {
			await saveGate;
			dispatch(
				sitesSlice.actions.updateSite({
					id: site.slug,
					changes: {
						metadata: { ...site.metadata, storage: 'opfs' },
					},
				})
			);
		});
		const prepareForSetupReplacement = vi.fn();
		const replacement = replaceTemporarySiteSetup({
			slug: site.slug,
			expectedSetup: {
				id: site.metadata.id,
				whenCreated: undefined,
				runtimeConfiguration: site.metadata.runtimeConfiguration,
				sourceSetupUrlFingerprint: undefined,
			},
			changes: {
				metadata: { whenCreated: 2 },
				originalUrlParams: undefined,
			},
			prepareForSetupReplacement,
		})(dispatch as any, () => state as any);

		releaseSave();
		await save;
		await expect(replacement).resolves.toBe(false);

		expect(prepareForSetupReplacement).not.toHaveBeenCalled();
		expect(state.sites.entities[site.slug]?.metadata.storage).toBe('opfs');
	});

	it('waits for bundle promotion before deleting a site', async () => {
		const { persistBlueprintBundleForSetup, removeSite, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
			clients: { ids: [], entities: {} },
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
				clients: state.clients,
			};
			return action;
		});
		let releasePromotion = () => {};
		const promotionWrite = new Promise<void>((resolve) => {
			releasePromotion = resolve;
		});
		persistBlueprintBundle.mockImplementationOnce(async () => {
			await promotionWrite;
			return {
				directory: 'blueprint-bundle-version',
				backend: { persisted: true },
			};
		});

		const promotion = persistBlueprintBundleForSetup({
			slug: site.slug,
			expectedSetup: {
				id: site.metadata.id,
				whenCreated: undefined,
				runtimeConfiguration: site.metadata.runtimeConfiguration,
				sourceSetupUrlFingerprint: undefined,
			},
			source: createBundleBlueprint(),
		})(dispatch as any, () => state as any);
		await vi.waitFor(() => {
			expect(persistBlueprintBundle).toHaveBeenCalledTimes(1);
		});
		const removal = removeSite(site.slug)(
			dispatch as any,
			() => state as any
		);
		await Promise.resolve();
		expect(deleteSite).not.toHaveBeenCalled();

		releasePromotion();
		await promotion;
		await removal;

		expect(deleteSite).toHaveBeenCalledWith(site.slug);
		expect(state.sites.entities[site.slug]).toBeUndefined();
	});

	it('detaches and discards the current runtime before deleting its files', async () => {
		const { removeSite, sitesSlice } = await import('./slice-sites');
		const { addClientInfo, default: clientsReducer } =
			await import('./slice-clients');
		const { abortSiteBoot, createSiteBootAbortController } =
			await import('../site-runtime-lock');
		const site = createSiteInfo();
		durableSitesForTest.set(site.slug, site);
		const order: string[] = [];
		const client = {
			flushOpfs: vi.fn(async () => {
				order.push('flush');
			}),
			unmountOpfs: vi.fn(async () => {
				order.push('unmount');
			}),
		};
		deleteSite.mockImplementationOnce(async (slug) => {
			order.push('delete');
			durableSitesForTest.delete(slug);
		});
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
			clients: clientsReducer(
				undefined,
				addClientInfo({
					siteSlug: site.slug,
					client: client as any,
					url: 'https://playground.test/',
					opfsMountDescriptor: {
						mountpoint: '/wordpress',
						device: {} as never,
					},
				})
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
				clients: clientsReducer(state.clients, action),
			};
			return action;
		});
		createSiteBootAbortController(site.slug);

		try {
			await removeSite(site.slug)(dispatch as any, () => state as any);
		} finally {
			abortSiteBoot(site.slug);
		}

		expect(order).toEqual(['flush', 'unmount', 'delete']);
		expect(state.sites.entities[site.slug]).toBeUndefined();
		expect(state.clients.entities[site.slug]).toBeUndefined();
	});

	it('keeps a site when another tab prevents exclusive runtime access', async () => {
		class RuntimeUnavailableError extends Error {}
		const runWithExclusiveSiteRuntimeLock = vi.fn(async () => {
			throw new RuntimeUnavailableError();
		});
		vi.doMock('../site-runtime-lock', () => ({
			getCurrentSiteBootSignal: vi.fn(),
			runWithExclusiveSiteRuntimeLock,
			SiteRuntimeLockUnavailableError: RuntimeUnavailableError,
			suspendCurrentSiteRuntime: vi.fn(),
		}));
		const { removeSite, sitesSlice } = await import('./slice-sites');
		const site = createSiteInfo();
		durableSitesForTest.set(site.slug, site);
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};

		await expect(
			removeSite(site.slug)(vi.fn() as any, () => state as any)
		).rejects.toBeInstanceOf(RuntimeUnavailableError);

		expect(runWithExclusiveSiteRuntimeLock).toHaveBeenCalledOnce();
		expect(deleteSite).not.toHaveBeenCalled();
		expect(state.sites.entities[site.slug]).toBe(site);
		vi.doUnmock('../site-runtime-lock');
	});

	it('merges partial metadata before writing and dispatching', async () => {
		const { sitesSlice, updateSite } = await import('./slice-sites');
		const site = createSiteInfo();
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state.sites = sitesSlice.reducer(state.sites, action);
			return action;
		});

		await updateSite({
			slug: site.slug,
			changes: {
				metadata: {
					name: 'Renamed Playground',
				} as any,
			},
		})(dispatch as any, () => state as any);

		expect(updateSiteStorage).toHaveBeenCalledWith(
			site.slug,
			expect.objectContaining({
				name: 'Renamed Playground',
				storage: 'opfs',
				runtimeConfiguration: site.metadata.runtimeConfiguration,
			}),
			undefined
		);
		expect(state.sites.entities[site.slug]?.metadata).toEqual({
			...site.metadata,
			name: 'Renamed Playground',
		});
	});

	it('does not update redux when saved-site storage is unavailable', async () => {
		vi.doMock('../opfs/opfs-site-storage', () => ({
			opfsSiteStorage: undefined,
		}));
		const { sitesSlice, updateSite } = await import('./slice-sites');
		const site = createSiteInfo();
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state.sites = sitesSlice.reducer(state.sites, action);
			return action;
		});

		await expect(
			updateSite({
				slug: site.slug,
				changes: {
					metadata: {
						...site.metadata,
						name: 'Renamed Playground',
					},
				},
			})(dispatch as any, () => state as any)
		).rejects.toThrow('browser storage is not available');

		expect(dispatch).not.toHaveBeenCalled();
	});

	it('does not replace a persisted bundle before validating the new setup', async () => {
		resolveRuntimeConfiguration.mockRejectedValue(
			new Error('Invalid setup')
		);
		const { resetAutosavedSiteSpec } = await import('./slice-sites');
		const resetSite = resetAutosavedSiteSpec(
			'autosaved-site',
			new URL(
				'https://playground.test/?blueprint-url=https://example.com'
			)
		);

		await expect(
			resetSite(createDispatch() as any, createGetState() as any)
		).rejects.toThrow('Invalid setup');

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
		expect(removeWordPressFilesKeepMetadata).not.toHaveBeenCalled();
	});

	it('does not persist a bundle for a new stored site before validating setup', async () => {
		resolveRuntimeConfiguration.mockRejectedValue(
			new Error('Invalid setup')
		);
		const { setStoredSiteSpec } = await import('./slice-sites');
		const addSite = setStoredSiteSpec(
			'Autosaved site',
			new URL(
				'https://playground.test/?blueprint-url=https://example.com'
			),
			'autosaved-site',
			{ persistence: 'autosave' }
		);

		await expect(
			addSite(createDispatch() as any, createEmptyGetState() as any)
		).rejects.toThrow('Invalid setup');

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
	});

	it('clears an unowned site path before staging its first bundle', async () => {
		const order: string[] = [];
		removeUnownedSiteDirectory.mockImplementationOnce(async () => {
			order.push('clear');
		});
		persistBlueprintBundle.mockImplementationOnce(async () => {
			order.push('stage');
			return {
				directory: 'blueprint-bundle-version',
				backend: { persisted: true },
			};
		});
		createSite.mockImplementationOnce(
			async (slug, metadata, originalUrlParams) => {
				order.push('create');
				durableSitesForTest.set(slug, {
					slug,
					metadata,
					originalUrlParams,
				});
			}
		);
		resolveRuntimeConfiguration.mockResolvedValue(
			createSiteInfo().metadata.runtimeConfiguration
		);
		const { setStoredSiteSpec } = await import('./slice-sites');

		await setStoredSiteSpec(
			'Fresh site',
			new URL('https://playground.test/'),
			'fresh-site'
		)(createDispatch() as any, createEmptyGetState() as any);

		expect(order).toEqual(['clear', 'stage', 'create']);
		expect(createSite).toHaveBeenCalledWith(
			'fresh-site',
			expect.objectContaining({
				originalBlueprintSource: {
					type: 'opfs-site',
					directory: 'blueprint-bundle-version',
				},
			}),
			{ searchParams: {}, hash: '' },
			{ reusePreparedDirectory: true }
		);
	});

	it('does not stage a reset bundle before runtime suspension succeeds', async () => {
		const { replaceAutosavedSiteSetup, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const suspensionError = new Error('runtime still mounted');

		await expect(
			replaceAutosavedSiteSetup({
				slug: site.slug,
				expectedSetup: {
					id: site.metadata.id,
					whenCreated: site.metadata.whenCreated,
					runtimeConfiguration: site.metadata.runtimeConfiguration,
					sourceSetupUrlFingerprint:
						site.metadata.sourceSetupUrlFingerprint,
				},
				changes: {
					metadata: { whenCreated: 2 },
					originalUrlParams: undefined,
				},
				blueprintBundle: createBundleBlueprint(),
				prepareForWordPressFileReset: async () => {
					throw suspensionError;
				},
			})(vi.fn() as any, () => state as any)
		).rejects.toBe(suspensionError);

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
	});

	it('removes a staged reset bundle when the pending marker was not written', async () => {
		const { replaceAutosavedSiteSetup, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		durableSitesForTest.set(site.slug, site);
		const state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const markerError = new Error('pending marker write failed');
		updateSiteStorage.mockRejectedValueOnce(markerError);
		const restore = vi.fn();
		const discard = vi.fn();

		await expect(
			replaceAutosavedSiteSetup({
				slug: site.slug,
				expectedSetup: {
					id: site.metadata.id,
					whenCreated: site.metadata.whenCreated,
					runtimeConfiguration: site.metadata.runtimeConfiguration,
					sourceSetupUrlFingerprint:
						site.metadata.sourceSetupUrlFingerprint,
				},
				changes: {
					metadata: { whenCreated: 2 },
					originalUrlParams: undefined,
				},
				blueprintBundle: createBundleBlueprint(),
				prepareForWordPressFileReset: async () => ({
					restore,
					discard,
				}),
			})(vi.fn() as any, () => state as any)
		).rejects.toBe(markerError);

		expect(deletePersistedBlueprintBundleVersion).toHaveBeenCalledWith(
			site.slug,
			'blueprint-bundle-version',
			undefined
		);
		expect(restore).toHaveBeenCalledOnce();
		expect(discard).not.toHaveBeenCalled();
	});

	it('forces crash recovery when reset cleanup and its durable read both fail', async () => {
		const { replaceAutosavedSiteSetup, sitesSlice } =
			await import('./slice-sites');
		const site = createSiteInfo();
		site.metadata.persistence = 'autosave';
		site.metadata.whenCreated = 1;
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(site)
			),
		};
		const dispatch = vi.fn((action) => {
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		const cleanupError = new Error('cleanup failed');
		const readError = new Error('metadata read failed');
		removeWordPressFilesKeepMetadata.mockRejectedValueOnce(cleanupError);
		readSiteStorage
			.mockResolvedValueOnce(site)
			.mockRejectedValueOnce(readError);

		await expect(
			replaceAutosavedSiteSetup({
				slug: site.slug,
				expectedSetup: {
					id: site.metadata.id,
					whenCreated: 1,
					runtimeConfiguration: site.metadata.runtimeConfiguration,
					sourceSetupUrlFingerprint: undefined,
				},
				changes: {
					metadata: { whenCreated: 2 },
					originalUrlParams: undefined,
				},
			})(dispatch as any, () => state as any)
		).rejects.toThrow(
			'Could not read storage after the Playground reset failed.'
		);

		expect(state.sites.entities[site.slug]?.metadata).toEqual({
			...site.metadata,
			whenCreated: 2,
			opfsSiteRemovalPending: true,
		});
	});

	it('checks durable slug ownership before copying a new site bundle', async () => {
		const { setStoredSiteSpec } = await import('./slice-sites');
		const existingSite = createSiteInfo();
		existingSite.slug = 'claimed';
		existingSite.metadata.id = 'other-tab-owner';
		listSitesStorage.mockResolvedValueOnce([]);
		readSiteStorage.mockResolvedValueOnce(existingSite);

		await expect(
			setStoredSiteSpec(
				'Claimed',
				new URL('https://playground.test/'),
				'claimed'
			)(createDispatch() as any, createEmptyGetState() as any)
		).rejects.toThrow('Site already exists: claimed');

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
	});
});

function createEmptyGetState() {
	return () => ({
		sites: {
			ids: [],
			entities: {},
			opfsSitesLoadingState: 'loaded',
			firstTemporarySiteCreated: false,
		},
	});
}

function createGetState() {
	return () => ({
		sites: {
			ids: ['autosaved-site'],
			entities: {
				'autosaved-site': {
					slug: 'autosaved-site',
					metadata: {
						id: 'autosaved-site',
						name: 'Autosaved site',
						storage: 'opfs',
						persistence: 'autosave',
						originalBlueprint: {},
						originalBlueprintSource: { type: 'none' },
						runtimeConfiguration: {
							phpVersion: '8.3',
							wpVersion: 'latest',
							intl: false,
							networking: true,
							extraLibraries: [],
							constants: {},
						},
					},
				},
			},
			opfsSitesLoadingState: 'loaded',
			firstTemporarySiteCreated: false,
		},
	});
}

function createSiteInfo({
	originalUrlParams,
}: {
	originalUrlParams?: OriginalUrlParams;
} = {}): SiteInfo {
	const site = {
		slug: 'stored-site',
		originalUrlParams,
		metadata: {
			id: 'stored-site',
			name: 'Stored site',
			storage: 'opfs' as const,
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' as const },
			runtimeConfiguration: {
				phpVersion: '8.3' as const,
				wpVersion: 'latest',
				intl: false,
				networking: true,
				extraLibraries: [],
				constants: {},
			},
		},
	};
	durableSitesForTest.set(site.slug, site);
	return site;
}

function createDispatch() {
	return vi.fn(async (action) => action);
}

function createBundleBlueprint() {
	return {
		read: vi.fn(),
		listFiles: vi.fn(),
		isDir: vi.fn(),
	};
}
