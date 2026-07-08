// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRuntimeConfiguration } from '@wp-playground/blueprints';
import type * as BlueprintsModule from '@wp-playground/blueprints';
import { resolveBlueprintFromURL } from '../url/resolve-blueprint-from-url';
import type * as ResolveBlueprintModule from '../url/resolve-blueprint-from-url';
import reducer, {
	addSite,
	pruneAutosavedSites,
	removeSite,
	resetAutosavedSiteSpec,
	sitesSlice,
	setTemporarySiteSpec,
	type SiteInfo,
	updateSiteMetadata,
} from './slice-sites';
import { selectActiveSite, setActiveSite } from './store';

const opfsMocks = vi.hoisted(() => {
	const opfsSiteStorage = {
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		resetSiteFiles: vi.fn(),
	};
	return {
		opfsSiteStorage,
		opfsSiteStorageMock: opfsSiteStorage,
	};
});

vi.mock('../opfs/opfs-site-storage', () => ({
	get opfsSiteStorage() {
		return opfsMocks.opfsSiteStorage;
	},
}));

vi.mock('@wp-playground/blueprints', async (importOriginal) => {
	const actual = await importOriginal<typeof BlueprintsModule>();
	return {
		...actual,
		BlueprintReflection: {
			create: vi.fn(async () => ({
				getVersion: () => 2,
			})),
		},
		resolveRuntimeConfiguration: vi.fn(),
	};
});

vi.mock('../url/resolve-blueprint-from-url', async (importOriginal) => {
	const actual = await importOriginal<typeof ResolveBlueprintModule>();
	return {
		...actual,
		resolveBlueprintFromURL: vi.fn(),
	};
});

vi.mock('./store', () => ({
	selectActiveSite: vi.fn(),
	setActiveSite: vi.fn((slug: string) => ({
		type: 'ui/setActiveSite',
		payload: slug,
	})),
}));

vi.mock('@php-wasm/logger', () => ({
	logger: {
		error: vi.fn(),
	},
}));

const createOpfsSite = vi.mocked(opfsMocks.opfsSiteStorageMock.create);
const updateOpfsSite = vi.mocked(opfsMocks.opfsSiteStorageMock.update);
const deleteOpfsSite = vi.mocked(opfsMocks.opfsSiteStorageMock.delete);
const resetOpfsSiteFiles = vi.mocked(
	opfsMocks.opfsSiteStorageMock.resetSiteFiles
);
const resolveBlueprint = vi.mocked(resolveBlueprintFromURL);
const getRuntimeConfiguration = vi.mocked(resolveRuntimeConfiguration);
const getActiveSite = vi.mocked(selectActiveSite);
const setActiveSiteAction = vi.mocked(setActiveSite);

beforeEach(() => {
	opfsMocks.opfsSiteStorage = opfsMocks.opfsSiteStorageMock;
	resolveBlueprint.mockReset();
	resolveBlueprint.mockResolvedValue({
		blueprint: { steps: [] },
		source: { type: 'none' },
	});
	getRuntimeConfiguration.mockReset();
	getRuntimeConfiguration.mockResolvedValue(createRuntimeConfiguration());
	resetOpfsSiteFiles.mockReset();
	resetOpfsSiteFiles.mockResolvedValue(undefined);
});

describe('site updates', () => {
	beforeEach(() => {
		createOpfsSite.mockReset();
		createOpfsSite.mockResolvedValue(undefined);
		updateOpfsSite.mockReset();
		updateOpfsSite.mockResolvedValue(undefined);
		deleteOpfsSite.mockReset();
		deleteOpfsSite.mockResolvedValue(undefined);
		getActiveSite.mockReset();
		setActiveSiteAction.mockClear();
	});

	it('keeps Redux unchanged when a stored site metadata write fails', async () => {
		updateOpfsSite.mockRejectedValueOnce(new Error('OPFS update failed'));
		const state = createState(createSite('stored', { name: 'Original' }));
		const dispatch = createDispatch(state);

		await expect(
			dispatch(
				updateSiteMetadata({
					slug: 'stored',
					changes: { name: 'Renamed' },
				})
			)
		).rejects.toThrow('OPFS update failed');

		expect(state.sites.entities.stored?.metadata.name).toBe('Original');
	});

	it('writes stored site metadata before updating Redux', async () => {
		const state = createState(createSite('stored', { name: 'Original' }));
		const dispatch = createDispatch(state);

		await dispatch(
			updateSiteMetadata({
				slug: 'stored',
				changes: { name: 'Renamed' },
			})
		);

		expect(updateOpfsSite).toHaveBeenCalledWith(
			'stored',
			expect.objectContaining({ name: 'Renamed' }),
			undefined
		);
		expect(state.sites.entities.stored?.metadata.name).toBe('Renamed');
	});

	it('replaces a temporary slug collision after the OPFS metadata write succeeds', async () => {
		const temporarySite = createSite('shared-blueprint-name', {
			storage: 'none',
			name: 'Shared Blueprint Name',
		});
		const storedSite = createSite('shared-blueprint-name', {
			storage: 'opfs',
			name: 'Shared Blueprint Name',
		});
		const state = createState(temporarySite);
		const dispatch = createDispatch(state);

		await dispatch(addSite(storedSite));

		expect(createOpfsSite).toHaveBeenCalledWith(
			'shared-blueprint-name',
			storedSite.metadata,
			undefined
		);
		expect(state.sites.entities['shared-blueprint-name']).toStrictEqual(
			storedSite
		);
	});

	it('keeps stored setup URL params when updating metadata', async () => {
		const site = createSite('stored', { name: 'Original' });
		site.originalUrlParams = {
			searchParams: { language: 'pl_PL' },
			hash: '#blueprint',
		};
		const state = createState(site);
		const dispatch = createDispatch(state);

		await dispatch(
			updateSiteMetadata({
				slug: 'stored',
				changes: { name: 'Renamed' },
			})
		);

		expect(updateOpfsSite).toHaveBeenCalledWith(
			'stored',
			expect.objectContaining({ name: 'Renamed' }),
			site.originalUrlParams
		);
	});

	it('keeps a temporary site temporary when storage promotion fails', async () => {
		updateOpfsSite.mockRejectedValueOnce(new Error('OPFS update failed'));
		const state = createState(
			createSite('temporary', { storage: 'none', name: 'Original' })
		);
		const dispatch = createDispatch(state);

		await expect(
			dispatch(
				updateSiteMetadata({
					slug: 'temporary',
					changes: { storage: 'opfs', name: 'Renamed' },
				})
			)
		).rejects.toThrow('OPFS update failed');

		expect(updateOpfsSite).toHaveBeenCalledWith(
			'temporary',
			expect.objectContaining({ storage: 'opfs', name: 'Renamed' }),
			undefined
		);
		expect(state.sites.entities.temporary?.metadata.storage).toBe('none');
		expect(state.sites.entities.temporary?.metadata.name).toBe('Original');
	});

	it('updates temporary site metadata without writing OPFS metadata', async () => {
		const state = createState(
			createSite('temporary', { storage: 'none', name: 'Original' })
		);
		const dispatch = createDispatch(state);

		await dispatch(
			updateSiteMetadata({
				slug: 'temporary',
				changes: { name: 'Renamed' },
			})
		);

		expect(updateOpfsSite).not.toHaveBeenCalled();
		expect(state.sites.entities.temporary?.metadata.name).toBe('Renamed');
	});

	it('updates local-directory metadata in Redux when OPFS metadata storage is unavailable', async () => {
		opfsMocks.opfsSiteStorage = undefined as any;
		const state = createState(
			createSite('local', { storage: 'local-fs', name: 'Original' })
		);
		const dispatch = createDispatch(state);

		await dispatch(
			updateSiteMetadata({
				slug: 'local',
				changes: { name: 'Renamed' },
			})
		);

		expect(updateOpfsSite).not.toHaveBeenCalled();
		expect(state.sites.entities.local?.metadata.name).toBe('Renamed');
	});

	it('rejects OPFS-backed metadata updates when OPFS metadata storage is unavailable', async () => {
		opfsMocks.opfsSiteStorage = undefined as any;
		const state = createState(
			createSite('stored', { storage: 'opfs', name: 'Original' })
		);
		const dispatch = createDispatch(state);

		await expect(
			dispatch(
				updateSiteMetadata({
					slug: 'stored',
					changes: { name: 'Renamed' },
				})
			)
		).rejects.toThrow('browser storage is not available');

		expect(state.sites.entities.stored?.metadata.name).toBe('Original');
	});
});

describe('site removal', () => {
	beforeEach(() => {
		updateOpfsSite.mockReset();
		deleteOpfsSite.mockReset();
		deleteOpfsSite.mockResolvedValue(undefined);
		getActiveSite.mockReset();
		setActiveSiteAction.mockClear();
	});

	it('keeps Redux unchanged when deleting a stored site from OPFS fails', async () => {
		deleteOpfsSite.mockRejectedValueOnce(new Error('OPFS delete failed'));
		const state = createState(createSite('stored'));
		const dispatch = createDispatch(state);

		await expect(dispatch(removeSite('stored'))).rejects.toThrow(
			'OPFS delete failed'
		);

		expect(deleteOpfsSite).toHaveBeenCalledWith('stored');
		expect(state.sites.entities.stored).toBeDefined();
	});

	it('removes a stored site only after deleting it from OPFS', async () => {
		const state = createState(createSite('stored'));
		const dispatch = createDispatch(state);

		await dispatch(removeSite('stored'));

		expect(deleteOpfsSite).toHaveBeenCalledWith('stored');
		expect(state.sites.entities.stored).toBeUndefined();
	});

	it('selects the newest remaining site after removing the active site', async () => {
		const activeSite = createSite('active', { whenCreated: 1 });
		const newestSite = createSite('newest', { whenCreated: 3 });
		const olderSite = createSite('older', { whenCreated: 2 });
		const state = createState(activeSite, newestSite, olderSite);
		getActiveSite.mockReturnValue(activeSite);
		const dispatch = createDispatch(state);

		await dispatch(removeSite('active'));

		expect(deleteOpfsSite).toHaveBeenCalledWith('active');
		expect(setActiveSiteAction).toHaveBeenCalledOnce();
		expect(setActiveSiteAction).toHaveBeenCalledWith('newest');
	});

	it('clears the active site after removing the only active site', async () => {
		const activeSite = createSite('active');
		const state = createState(activeSite);
		getActiveSite.mockReturnValue(activeSite);
		const dispatch = createDispatch(state);

		await dispatch(removeSite('active'));

		expect(deleteOpfsSite).toHaveBeenCalledWith('active');
		expect(setActiveSiteAction).toHaveBeenCalledWith(undefined);
	});

	it('rejects temporary site removal', async () => {
		const state = createState(createSite('temporary', { storage: 'none' }));
		const dispatch = createDispatch(state);

		await expect(dispatch(removeSite('temporary'))).rejects.toThrow(
			'Cannot remove a temporary site.'
		);

		expect(deleteOpfsSite).not.toHaveBeenCalled();
		expect(state.sites.entities.temporary).toBeDefined();
	});

	it('removes local-directory sites from the session when OPFS metadata storage is unavailable', async () => {
		opfsMocks.opfsSiteStorage = undefined as any;
		const state = createState(createSite('local', { storage: 'local-fs' }));
		const dispatch = createDispatch(state);

		await dispatch(removeSite('local'));

		expect(deleteOpfsSite).not.toHaveBeenCalled();
		expect(state.sites.entities.local).toBeUndefined();
	});

	it('rejects OPFS-backed site removal when OPFS metadata storage is unavailable', async () => {
		opfsMocks.opfsSiteStorage = undefined as any;
		const state = createState(createSite('stored', { storage: 'opfs' }));
		const dispatch = createDispatch(state);

		await expect(dispatch(removeSite('stored'))).rejects.toThrow(
			'browser storage is not available'
		);

		expect(deleteOpfsSite).not.toHaveBeenCalled();
		expect(state.sites.entities.stored).toBeDefined();
	});

	it('does not fail the current save when pruning an old autosave fails', async () => {
		deleteOpfsSite.mockRejectedValueOnce(new Error('OPFS delete failed'));
		const state = createState(
			createSite('newer-autosave', {
				persistence: 'autosave',
				whenLastUsed: 2,
			}),
			createSite('older-autosave', {
				persistence: 'autosave',
				whenLastUsed: 1,
			})
		);
		const dispatch = createDispatch(state);

		await expect(
			dispatch(pruneAutosavedSites({ limit: 1 }))
		).resolves.toBeUndefined();

		expect(deleteOpfsSite).toHaveBeenCalledWith('older-autosave');
		expect(state.sites.entities['older-autosave']).toBeDefined();
	});
});

describe('temporary site creation', () => {
	it('reuses a matching temporary site and removes stale temporary sites', async () => {
		const matchingSite = createSite('matching-temporary', {
			storage: 'none',
		});
		matchingSite.originalUrlParams = {
			searchParams: { php: '8.4' },
			hash: '',
		};
		const staleSite = createSite('stale-temporary', { storage: 'none' });
		staleSite.originalUrlParams = {
			searchParams: { php: '8.3' },
			hash: '',
		};
		const state = createState(matchingSite, staleSite);
		const dispatch = createDispatch(state);

		const result = await dispatch(
			setTemporarySiteSpec(
				'Temporary',
				new URL('https://playground.test/?php=8.4')
			)
		);

		expect(result).toBe(matchingSite);
		expect(resolveBlueprint).not.toHaveBeenCalled();
		expect(state.sites.entities['matching-temporary']).toBeDefined();
		expect(state.sites.entities['stale-temporary']).toBeUndefined();
	});

	it('reuses a matching temporary site when setup params are ordered differently', async () => {
		const matchingSite = createSite('matching-temporary', {
			storage: 'none',
		});
		matchingSite.originalUrlParams = {
			searchParams: {
				theme: 'twentytwentyfive',
				plugin: ['gutenberg', 'akismet'],
			},
			hash: '',
		};
		const state = createState(matchingSite);
		const dispatch = createDispatch(state);

		const result = await dispatch(
			setTemporarySiteSpec(
				'Temporary',
				new URL(
					'https://playground.test/?plugin=akismet&theme=twentytwentyfive&plugin=gutenberg'
				)
			)
		);

		expect(result).toBe(matchingSite);
		expect(resolveBlueprint).not.toHaveBeenCalled();
	});

	it('creates a fresh temporary site when the route carries a random nonce', async () => {
		const existingSite = createSite('existing-temporary', {
			storage: 'none',
		});
		existingSite.originalUrlParams = {
			searchParams: { php: '8.4', storage: 'temp' },
			hash: '',
		};
		const state = createState(existingSite);
		const dispatch = createDispatch(state);

		const result = await dispatch(
			setTemporarySiteSpec(
				'Temporary',
				new URL(
					'https://playground.test/?storage=temp&php=8.4&random=fresh'
				)
			)
		);

		expect(result.slug).not.toBe(existingSite.slug);
		expect(resolveBlueprint).toHaveBeenCalled();
		expect(state.sites.entities[existingSite.slug]).toBeUndefined();
		expect(state.sites.entities[result.slug]).toBeDefined();
	});

	it('does not reuse a different temporary site for a requested slug', async () => {
		const existingSite = createSite('existing-temporary', {
			storage: 'none',
		});
		existingSite.originalUrlParams = {
			searchParams: { php: '8.4' },
			hash: '',
		};
		const state = createState(existingSite);
		const dispatch = createDispatch(state);

		const result = await dispatch(
			setTemporarySiteSpec(
				'Temporary',
				new URL('https://playground.test/?php=8.4'),
				'requested-temporary'
			)
		);

		expect(result.slug).toBe('requested-temporary');
		expect(resolveBlueprint).toHaveBeenCalled();
		expect(state.sites.entities[existingSite.slug]).toBeUndefined();
		expect(state.sites.entities['requested-temporary']).toBeDefined();
	});

	it('stores only setup parameters plus temporary storage marker', async () => {
		const state = createState();
		const dispatch = createDispatch(state);

		const result = await dispatch(
			setTemporarySiteSpec(
				'Temporary',
				new URL(
					'https://playground.test/?site-slug=saved&overlay=new&page-title=Ignored&storage=temp&php=8.4&plugin=akismet&random=abc#blueprint'
				)
			)
		);

		expect(result.originalUrlParams).toEqual({
			searchParams: {
				php: '8.4',
				plugin: 'akismet',
				storage: 'temp',
			},
			hash: '#blueprint',
		});
	});
});

describe('autosaved site reset', () => {
	beforeEach(() => {
		updateOpfsSite.mockReset();
		updateOpfsSite.mockResolvedValue(undefined);
		deleteOpfsSite.mockReset();
		getActiveSite.mockReset();
		setActiveSiteAction.mockClear();
	});

	it('persists a reset marker before deleting old WordPress files', async () => {
		const state = createState(
			createSite('autosaved', {
				persistence: 'autosave',
				playgroundDefinedConstants: { WP_DEBUG: true },
			})
		);
		const dispatch = createDispatch(state);

		await dispatch(
			resetAutosavedSiteSpec(
				'autosaved',
				new URL('https://playground.test/?php=8.4')
			)
		);

		expect(updateOpfsSite).toHaveBeenNthCalledWith(
			1,
			'autosaved',
			expect.objectContaining({
				initialOpfsSyncPending: true,
				opfsResetPending: true,
				playgroundDefinedConstants: undefined,
			}),
			expect.objectContaining({
				searchParams: expect.objectContaining({ php: '8.4' }),
			})
		);
		expect(updateOpfsSite.mock.invocationCallOrder[0]).toBeLessThan(
			resetOpfsSiteFiles.mock.invocationCallOrder[0]
		);
		expect(resetOpfsSiteFiles).toHaveBeenCalledWith('autosaved');
		expect(updateOpfsSite).toHaveBeenNthCalledWith(
			2,
			'autosaved',
			expect.objectContaining({
				initialOpfsSyncPending: true,
				opfsResetPending: undefined,
			}),
			expect.objectContaining({
				searchParams: expect.objectContaining({ php: '8.4' }),
			})
		);
		expect(resetOpfsSiteFiles.mock.invocationCallOrder[0]).toBeLessThan(
			updateOpfsSite.mock.invocationCallOrder[1]
		);
		expect(
			state.sites.entities.autosaved?.metadata.initialOpfsSyncPending
		).toBe(true);
		expect(
			state.sites.entities.autosaved?.metadata.opfsResetPending
		).toBeUndefined();
		expect(
			state.sites.entities.autosaved?.metadata.playgroundDefinedConstants
		).toBeUndefined();
	});

	it('keeps Redux unchanged when deleting old WordPress files fails', async () => {
		const resetError = new Error('reset failed');
		resetOpfsSiteFiles.mockRejectedValueOnce(resetError);
		const site = createSite('autosaved', {
			name: 'Original',
			persistence: 'autosave',
			whenCreated: 1,
			whenLastUsed: 1,
		});
		const state = createState(site);
		const dispatch = createDispatch(state);

		await expect(
			dispatch(
				resetAutosavedSiteSpec(
					'autosaved',
					new URL('https://playground.test/?php=8.4')
				)
			)
		).rejects.toBe(resetError);

		expect(updateOpfsSite).toHaveBeenCalledTimes(1);
		expect(updateOpfsSite).toHaveBeenCalledWith(
			'autosaved',
			expect.objectContaining({
				opfsResetPending: true,
			}),
			expect.anything()
		);
		expect(resetOpfsSiteFiles).toHaveBeenCalledWith('autosaved');
		expect(state.sites.entities.autosaved?.metadata).toEqual(site.metadata);
		expect(state.sites.entities.autosaved?.originalUrlParams).toEqual(
			site.originalUrlParams
		);
	});
});

function createDispatch(state: { sites: ReturnType<typeof reducer> }) {
	const dispatch = vi.fn((action: unknown) => {
		if (typeof action === 'function') {
			return action(dispatch, () => state as any);
		}
		state.sites = reducer(state.sites, action as any);
		return action;
	}) as any;
	return dispatch;
}

function createState(...sites: SiteInfo[]) {
	return {
		sites: reducer(undefined, sitesSlice.actions.addSites(sites)),
	};
}

function createSite(
	slug: string,
	metadata: Partial<SiteInfo['metadata']> = {}
): SiteInfo {
	return {
		slug,
		metadata: {
			storage: 'opfs',
			id: slug,
			name: slug,
			whenCreated: 0,
			persistence: 'explicit',
			runtimeConfiguration: createRuntimeConfiguration(),
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' },
			...metadata,
		},
	};
}

function createRuntimeConfiguration(): SiteInfo['metadata']['runtimeConfiguration'] {
	return {
		phpVersion: '8.3',
		wpVersion: 'latest',
		intl: false,
		networking: true,
		extraLibraries: [],
		constants: {},
	};
}
