import {
	RECENT_AUTOSAVE_RESTORE_WINDOW_MS,
	getAutosavedSitesToPrune,
	getSitePublicPersistence,
	getSitesSortedByRecency,
	isAutosavedSite,
	wasSiteRecentlyInteractedWith,
} from './site-lifecycle';
import type { SiteInfo } from './slice-sites';

describe('autosaved site helpers', () => {
	it('treats legacy browser-stored sites without persistence metadata as explicit', () => {
		expect(
			isAutosavedSite(
				createSite('legacy', {
					storage: 'opfs',
					persistence: undefined,
				})
			)
		).toBe(false);
	});

	it('only exposes persistence for stored sites', () => {
		expect(
			getSitePublicPersistence(
				createSite('temporary', { storage: 'none' })
			)
		).toBeUndefined();
		expect(
			getSitePublicPersistence(
				createSite('autosave', { persistence: 'autosave' })
			)
		).toBe('autosave');
		expect(
			getSitePublicPersistence(
				createSite('explicit', { persistence: 'explicit' })
			)
		).toBe('explicit');
		expect(
			getSitePublicPersistence(
				createSite('legacy', { persistence: undefined })
			)
		).toBe('explicit');
	});

	it('prunes only autosaved sites older than the latest limit', () => {
		const sites = [
			createSite('explicit-old', {
				storage: 'opfs',
				persistence: 'explicit',
				whenCreated: 1,
			}),
			createSite('legacy-old', {
				storage: 'opfs',
				persistence: undefined,
				whenCreated: 2,
			}),
			createSite('local-old', {
				storage: 'local-fs',
				persistence: 'explicit',
				whenCreated: 3,
			}),
			createSite('auto-1', { persistence: 'autosave', whenCreated: 10 }),
			createSite('auto-2', { persistence: 'autosave', whenCreated: 20 }),
			createSite('auto-3', { persistence: 'autosave', whenCreated: 30 }),
			createSite('auto-4', { persistence: 'autosave', whenCreated: 40 }),
			createSite('auto-5', { persistence: 'autosave', whenCreated: 50 }),
			createSite('auto-6', { persistence: 'autosave', whenCreated: 60 }),
		];

		expect(
			getAutosavedSitesToPrune(sites).map((site) => site.slug)
		).toEqual(['auto-1']);
	});

	it('uses whenLastUsed before whenCreated for autosave retention', () => {
		const sites = [
			createSite('recently-used-old-site', {
				persistence: 'autosave',
				whenCreated: 1,
				whenLastUsed: 100,
			}),
			createSite('newer-unused-site', {
				persistence: 'autosave',
				whenCreated: 90,
			}),
		];

		expect(
			getAutosavedSitesToPrune(sites, { limit: 1 }).map(
				(site) => site.slug
			)
		).toEqual(['newer-unused-site']);
	});

	it('can protect a specific autosaved site from pruning', () => {
		const sites = [
			createSite('old-active', {
				persistence: 'autosave',
				whenCreated: 1,
			}),
			createSite('new-1', { persistence: 'autosave', whenCreated: 10 }),
			createSite('new-2', { persistence: 'autosave', whenCreated: 20 }),
		];

		expect(
			getAutosavedSitesToPrune(sites, {
				limit: 2,
				excludeSlugs: ['old-active'],
			}).map((site) => site.slug)
		).toEqual(['new-1']);
	});

	it('only treats recently interacted-with sites as restore candidates', () => {
		const now = Date.now();

		expect(
			wasSiteRecentlyInteractedWith(
				createSite('recent', {
					persistence: 'autosave',
					whenLastUsed: now - RECENT_AUTOSAVE_RESTORE_WINDOW_MS + 1,
				}),
				now
			)
		).toBe(true);
		expect(
			wasSiteRecentlyInteractedWith(
				createSite('stale', {
					persistence: 'autosave',
					whenLastUsed: now - RECENT_AUTOSAVE_RESTORE_WINDOW_MS - 1,
				}),
				now
			)
		).toBe(false);
	});
});

describe('site recency helpers', () => {
	it('sorts sites by recency without mutating the input array', () => {
		const sites = [
			createSite('a-old', { whenCreated: 1 }),
			createSite('b-new', { whenCreated: 2 }),
		];

		expect(getSitesSortedByRecency(sites).map((site) => site.slug)).toEqual(
			['b-new', 'a-old']
		);
		expect(sites.map((site) => site.slug)).toEqual(['a-old', 'b-new']);
	});
});

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
			...metadata,
		},
	};
}
