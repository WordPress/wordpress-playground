// @vitest-environment jsdom

import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import type * as SliceSitesModule from './slice-sites';
import type { SiteInfo } from './slice-sites';
import { createSitesAPI } from './site-management-api-middleware';

const mocks = vi.hoisted(() => ({
	persistTemporarySite: vi.fn(),
	pruneAutosavedSites: vi.fn(),
}));

vi.mock('./persist-temporary-site', () => ({
	persistTemporarySite: mocks.persistTemporarySite,
}));

vi.mock('./slice-sites', async (importOriginal) => ({
	...(await importOriginal<typeof SliceSitesModule>()),
	pruneAutosavedSites: mocks.pruneAutosavedSites,
}));

vi.mock('./store', () => ({
	selectActiveSite: (state: PlaygroundReduxState) =>
		state.ui.activeSite?.slug
			? state.sites.entities[state.ui.activeSite.slug]
			: undefined,
	selectActiveSiteError: vi.fn(),
	selectActiveSiteErrorDetails: vi.fn(),
	setActiveSite: vi.fn(),
	useAppDispatch: vi.fn(),
}));

describe('createSitesAPI', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.pruneAutosavedSites.mockImplementation(() => vi.fn());
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shares an autosave between API instances for the same store', async () => {
		const site = createTemporarySite();
		const state = createState(site);
		let finishPersistence!: () => void;
		const persistenceCanFinish = new Promise<void>((resolve) => {
			finishPersistence = resolve;
		});
		const persist = vi.fn(async () => {
			await persistenceCanFinish;
			site.metadata.storage = 'opfs';
		});
		mocks.persistTemporarySite.mockReturnValue(persist);
		const dispatch = createDispatch(persist);
		const firstApi = createSitesAPI(() => state, dispatch);
		const secondApi = createSitesAPI(() => state, dispatch);

		const firstAutosave = firstApi.autosaveTemporarySite(site.slug);
		const secondAutosave = secondApi.autosaveTemporarySite(site.slug);

		await vi.waitFor(() =>
			expect(mocks.persistTemporarySite).toHaveBeenCalledTimes(1)
		);
		finishPersistence();
		await expect(
			Promise.all([firstAutosave, secondAutosave])
		).resolves.toEqual([
			{ slug: site.slug, storage: 'opfs' },
			{ slug: site.slug, storage: 'opfs' },
		]);
	});

	it('waits for finalization when persistence has already updated storage', async () => {
		const site = createTemporarySite();
		const state = createState(site);
		let finishPersistence!: () => void;
		const persistenceCanFinish = new Promise<void>((resolve) => {
			finishPersistence = resolve;
		});
		const persist = vi.fn(async () => {
			await persistenceCanFinish;
			site.metadata.storage = 'opfs';
		});
		mocks.persistTemporarySite.mockReturnValue(persist);
		let finishPruning!: () => void;
		const pruningCanFinish = new Promise<void>((resolve) => {
			finishPruning = resolve;
		});
		const prune = vi.fn();
		mocks.pruneAutosavedSites.mockReturnValue(prune);
		const dispatch = createDispatch(persist, (action) =>
			action === prune ? pruningCanFinish : Promise.resolve()
		);
		const api = createSitesAPI(() => state, dispatch);
		const pushState = vi
			.spyOn(window.history, 'pushState')
			.mockImplementation(() => undefined);

		const firstAutosave = api.autosaveTemporarySite(site.slug);
		finishPersistence();
		await vi.waitFor(() =>
			expect(mocks.pruneAutosavedSites).toHaveBeenCalledTimes(1)
		);
		const secondAutosave = api.autosaveTemporarySite(site.slug, {
			updateUrl: true,
			excludeFromPruning: ['late-exclusion'],
		});
		let secondAutosaveFinished = false;
		void secondAutosave.then(() => {
			secondAutosaveFinished = true;
		});
		await Promise.resolve();

		expect(secondAutosaveFinished).toBe(false);
		expect(mocks.pruneAutosavedSites).toHaveBeenCalledWith({
			excludeSlugs: [site.slug, 'late-exclusion'],
		});
		expect(pushState).not.toHaveBeenCalled();
		finishPruning();
		await expect(
			Promise.all([firstAutosave, secondAutosave])
		).resolves.toEqual([
			{ slug: site.slug, storage: 'opfs' },
			{ slug: site.slug, storage: 'opfs' },
		]);
		expect(pushState).toHaveBeenCalledTimes(1);
	});

	it('applies each concurrent caller’s routing and pruning options', async () => {
		const site = createTemporarySite();
		const state = createState(site);
		let finishPersistence!: () => void;
		const persistenceCanFinish = new Promise<void>((resolve) => {
			finishPersistence = resolve;
		});
		const persist = vi.fn(async () => {
			await persistenceCanFinish;
			site.metadata.storage = 'opfs';
		});
		mocks.persistTemporarySite.mockReturnValue(persist);
		const dispatch = createDispatch(persist);
		const api = createSitesAPI(() => state, dispatch);
		const pushState = vi
			.spyOn(window.history, 'pushState')
			.mockImplementation(() => undefined);

		const firstAutosave = api.autosaveTemporarySite(site.slug, {
			excludeFromPruning: ['first-exclusion'],
		});
		const secondAutosave = api.autosaveTemporarySite(site.slug, {
			updateUrl: true,
			excludeFromPruning: ['second-exclusion'],
		});
		finishPersistence();
		await Promise.all([firstAutosave, secondAutosave]);

		expect(mocks.persistTemporarySite).toHaveBeenCalledTimes(1);
		expect(mocks.persistTemporarySite).toHaveBeenCalledWith(
			site.slug,
			'opfs',
			{
				skipRenameModal: true,
				persistence: 'autosave',
				updateUrl: false,
			}
		);
		expect(mocks.pruneAutosavedSites).toHaveBeenCalledOnce();
		expect(mocks.pruneAutosavedSites).toHaveBeenCalledWith({
			excludeSlugs: [site.slug, 'first-exclusion', 'second-exclusion'],
		});
		expect(pushState).toHaveBeenCalledTimes(1);
	});
});

function createDispatch(
	persist: () => Promise<void>,
	dispatchOther: (action: unknown) => Promise<unknown> = () =>
		Promise.resolve()
): PlaygroundDispatch {
	return vi.fn((action) => {
		if (action === persist) {
			return persist();
		}
		return dispatchOther(action);
	}) as unknown as PlaygroundDispatch;
}

function createState(site: SiteInfo): PlaygroundReduxState {
	return {
		ui: { activeSite: { slug: site.slug } },
		sites: {
			ids: [site.slug],
			entities: { [site.slug]: site },
		},
	} as PlaygroundReduxState;
}

function createTemporarySite(): SiteInfo {
	return {
		slug: 'test-site',
		metadata: {
			id: 'test-site',
			name: 'Test Playground',
			storage: 'none',
			whenCreated: 0,
			runtimeConfiguration: {
				phpVersion: '8.3',
				wpVersion: 'latest',
				intl: false,
				networking: true,
				extraLibraries: [],
				constants: {},
			},
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' },
		},
	};
}
