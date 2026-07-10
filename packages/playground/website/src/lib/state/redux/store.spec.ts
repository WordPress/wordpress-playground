// @vitest-environment jsdom

import { selectActiveStoredSite } from './store';
import type { PlaygroundReduxState } from './store';
import { selectSortedStoredSites } from './slice-sites';
import type { SiteInfo } from './slice-sites';

describe('saved Playground state selectors', () => {
	it('returns the active stored site with a stable reference', () => {
		const temporarySite = createSite('temporary', 'none', 1);
		const storedSite = createSite('stored', 'opfs', 2);
		const localStoredSite = createSite('local', 'local-fs', 3);
		const state = createState(storedSite.slug, [temporarySite, storedSite]);

		const activeStoredSite = selectActiveStoredSite(state);

		expect(activeStoredSite).toBe(storedSite);
		expect(selectActiveStoredSite(state)).toBe(activeStoredSite);
		expect(
			selectActiveStoredSite(
				createState(localStoredSite.slug, [localStoredSite])
			)
		).toBe(localStoredSite);
	});

	it('does not classify temporary or missing active sites as stored', () => {
		const temporarySite = createSite('temporary', 'none', 1);

		expect(
			selectActiveStoredSite(
				createState(temporarySite.slug, [temporarySite])
			)
		).toBeUndefined();
		expect(
			selectActiveStoredSite(createState(undefined, [temporarySite]))
		).toBeUndefined();
		expect(
			selectActiveStoredSite(createState('missing', []))
		).toBeUndefined();
	});

	it('returns a stable recency-sorted list without temporary sites', () => {
		const temporarySite = createSite('temporary', 'none', 3);
		const olderStoredSite = createSite('older', 'opfs', 1);
		const newerStoredSite = createSite('newer', 'local-fs', 2);
		const state = createState(undefined, [
			temporarySite,
			olderStoredSite,
			newerStoredSite,
		]);

		const storedSites = selectSortedStoredSites(state);

		expect(storedSites).toEqual([newerStoredSite, olderStoredSite]);
		expect(selectSortedStoredSites(state)).toBe(storedSites);
	});
});

function createState(
	activeSiteSlug: string | undefined,
	sites: SiteInfo[]
): PlaygroundReduxState {
	return {
		ui: {
			activeSite: activeSiteSlug
				? {
						slug: activeSiteSlug,
					}
				: undefined,
		},
		sites: {
			ids: sites.map((site) => site.slug),
			entities: Object.fromEntries(
				sites.map((site) => [site.slug, site])
			),
		},
	} as PlaygroundReduxState;
}

function createSite(
	slug: string,
	storage: SiteInfo['metadata']['storage'],
	whenCreated: number
): SiteInfo {
	return {
		slug,
		metadata: {
			id: slug,
			name: slug,
			storage,
			whenCreated,
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
