import type { OriginalUrlParams } from '../original-url-params';
import type { SiteInfo } from './slice-sites';
import type { TraversableFilesystemBackend } from '@wp-playground/storage';

describe('stored site creation', () => {
	let createSite: ReturnType<typeof vi.fn>;
	let updateSiteStorage: ReturnType<typeof vi.fn>;
	let persistBlueprintBundle: ReturnType<typeof vi.fn>;
	let deleteBlueprintBundle: ReturnType<typeof vi.fn>;
	let removeWordPressFilesKeepMetadata: ReturnType<typeof vi.fn>;
	let resolveRuntimeConfiguration: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		createSite = vi.fn();
		updateSiteStorage = vi.fn();
		persistBlueprintBundle = vi.fn();
		deleteBlueprintBundle = vi.fn();
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
			deleteBlueprintBundle,
			isTraversableFilesystemBackend: (value: unknown) =>
				typeof value === 'object' &&
				value !== null &&
				typeof (value as { read?: unknown }).read === 'function' &&
				typeof (value as { listFiles?: unknown }).listFiles ===
					'function' &&
				typeof (value as { isDir?: unknown }).isDir === 'function',
			persistBlueprintBundle,
		}));
		vi.doMock('../opfs/opfs-site-storage', () => ({
			opfsSiteStorage: {
				create: createSite,
				update: updateSiteStorage,
				removeWordPressFilesKeepMetadata,
			},
		}));
		vi.doMock('../playground-identity', () => ({
			getAutosaveFingerprintFromURL: () => 'fingerprint',
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

	it('keeps setStoredSiteSpec as the setup URL compatibility alias', async () => {
		resolveRuntimeConfiguration.mockRejectedValue(
			new Error('Invalid setup')
		);
		const { createStoredSite, setStoredSiteSpec } =
			await import('./slice-sites');
		expect(setStoredSiteSpec).toBe(createStoredSite);
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

	it('creates a new stored site from an edited Blueprint bundle', async () => {
		const { createStoredSite, sitesSlice } = await import('./slice-sites');
		const runtimeConfiguration = {
			phpVersion: '8.3',
			wpVersion: 'latest',
			intl: false,
			networking: true,
			extraLibraries: [],
			constants: {},
		};
		resolveRuntimeConfiguration.mockResolvedValue(runtimeConfiguration);
		const sourceSite = createSiteInfo({
			slug: 'source-site',
			name: 'Original Playground',
		});
		const editedBundle = createBundleBlueprint();
		let state = {
			sites: sitesSlice.reducer(
				undefined,
				sitesSlice.actions.addSite(sourceSite)
			),
		};
		const getState = () => state;
		const dispatch = vi.fn();
		dispatch.mockImplementation((action) => {
			if (typeof action === 'function') {
				return action(dispatch, getState);
			}
			state = {
				sites: sitesSlice.reducer(state.sites, action),
			};
			return action;
		});
		const writes: string[] = [];
		persistBlueprintBundle.mockImplementation(async () => {
			writes.push('bundle');
		});
		createSite.mockImplementation(async () => {
			writes.push('metadata');
		});

		const newSite = await createStoredSite(
			'Edited Blueprint',
			editedBundle,
			'source-site',
			{ persistence: 'autosave' }
		)(dispatch as any, getState as any);

		expect(newSite.slug).toBe('source-site-2');
		expect(newSite.metadata).toMatchObject({
			name: 'Edited Blueprint',
			storage: 'opfs',
			persistence: 'autosave',
			initialOpfsSyncPending: true,
			originalBlueprint: editedBundle,
			originalBlueprintSource: { type: 'opfs-site' },
			runtimeConfiguration,
		});
		expect(persistBlueprintBundle).toHaveBeenCalledWith(
			'source-site-2',
			editedBundle
		);
		expect(createSite).toHaveBeenCalledWith(
			'source-site-2',
			newSite.metadata,
			undefined
		);
		expect(deleteBlueprintBundle).not.toHaveBeenCalled();
		expect(writes).toEqual(['bundle', 'metadata']);
		expect(state.sites.entities).toMatchObject({
			'source-site': sourceSite,
			'source-site-2': newSite,
		});
	});

	it('does not persist an edited Blueprint bundle when its runtime is invalid', async () => {
		resolveRuntimeConfiguration.mockRejectedValue(
			new Error('Invalid setup')
		);
		const { createStoredSite } = await import('./slice-sites');

		await expect(
			createStoredSite('Edited Blueprint', createBundleBlueprint())(
				createDispatch() as any,
				createEmptyGetState() as any
			)
		).rejects.toThrow('Invalid setup');

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
		expect(createSite).not.toHaveBeenCalled();
	});

	it('removes an edited Blueprint bundle when site creation fails', async () => {
		const { createStoredSite } = await import('./slice-sites');
		resolveRuntimeConfiguration.mockResolvedValue({
			phpVersion: '8.3',
			wpVersion: 'latest',
			intl: false,
			networking: true,
			extraLibraries: [],
			constants: {},
		});
		createSite.mockRejectedValue(new Error('Could not write metadata'));

		await expect(
			createStoredSite(
				'Edited Blueprint',
				createBundleBlueprint(),
				'edited-blueprint'
			)(createThunkDispatch() as any, createEmptyGetState() as any)
		).rejects.toThrow('Could not write metadata');

		expect(deleteBlueprintBundle).toHaveBeenCalledWith('edited-blueprint');
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
	slug = 'stored-site',
	name = 'Stored site',
}: {
	originalUrlParams?: OriginalUrlParams;
	slug?: string;
	name?: string;
} = {}): SiteInfo {
	return {
		slug,
		originalUrlParams,
		metadata: {
			id: slug,
			name,
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
}

function createDispatch() {
	return vi.fn(async (action) => action);
}

function createThunkDispatch() {
	const dispatch = vi.fn();
	dispatch.mockImplementation(async (action) => {
		if (typeof action === 'function') {
			return action(dispatch, createEmptyGetState());
		}
		return action;
	});
	return dispatch;
}

function createBundleBlueprint(): TraversableFilesystemBackend {
	return {
		read: vi.fn(),
		listFiles: vi.fn(),
		isDir: vi.fn(),
	};
}
