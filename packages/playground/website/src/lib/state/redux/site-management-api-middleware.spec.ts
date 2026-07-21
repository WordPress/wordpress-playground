// @vitest-environment jsdom

import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import type { SiteInfo } from './slice-sites';
import { createSitesAPI } from './site-management-api-middleware';

const mocks = vi.hoisted(() => ({
	persistTemporarySite: vi.fn(),
}));

vi.mock('./persist-temporary-site', () => ({
	persistTemporarySite: mocks.persistTemporarySite,
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
	it('shares an autosave already running for the same site', async () => {
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
		const dispatch = vi.fn((action) => {
			if (action === persist) {
				return persist();
			}
			return Promise.resolve();
		}) as unknown as PlaygroundDispatch;
		const api = createSitesAPI(() => state, dispatch);

		const firstAutosave = api.autosaveTemporarySite(site.slug);
		const secondAutosave = api.autosaveTemporarySite(site.slug);

		expect(mocks.persistTemporarySite).toHaveBeenCalledTimes(1);
		finishPersistence();
		await expect(
			Promise.all([firstAutosave, secondAutosave])
		).resolves.toEqual([
			{ slug: site.slug, storage: 'opfs' },
			{ slug: site.slug, storage: 'opfs' },
		]);
	});
});

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
