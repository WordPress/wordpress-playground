// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/remote';
import { createSitesAPI } from './site-management-api-middleware';
import sitesReducer from './slice-sites';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import type { SiteInfo } from './slice-sites';

const mocks = vi.hoisted(() => ({
	setActiveSite: vi.fn(
		(slug: string | undefined, _options: { updateUrl?: boolean } = {}) =>
			(
				dispatch: PlaygroundDispatch,
				_getState: () => PlaygroundReduxState
			) =>
				dispatch({ type: 'ui/setActiveSite', payload: slug })
	),
	opfsSiteStorage: {
		create: vi.fn(),
		delete: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock('../opfs/opfs-site-storage', () => ({
	opfsSiteStorage: mocks.opfsSiteStorage,
	getDirectoryPathForSite: (site: SiteInfo) => `/sites/${site.slug}`,
}));

vi.mock('./store', () => ({
	selectActiveSite: (state: PlaygroundReduxState) =>
		state.ui.activeSite?.slug
			? state.sites.entities[state.ui.activeSite.slug]
			: undefined,
	selectActiveSiteError: (state: PlaygroundReduxState) =>
		state.ui.activeSite?.error,
	selectActiveSiteErrorDetails: (state: PlaygroundReduxState) =>
		state.ui.activeSite?.errorDetails,
	setActiveSite: mocks.setActiveSite,
	useAppDispatch: vi.fn(),
}));

describe('createSitesAPI', () => {
	beforeEach(() => {
		mocks.setActiveSite.mockClear();
		mocks.opfsSiteStorage.create.mockReset();
		mocks.opfsSiteStorage.delete.mockReset();
		mocks.opfsSiteStorage.update.mockReset();
		mocks.opfsSiteStorage.update.mockResolvedValue(undefined);
	});

	it('resolves when switching to an already booted inactive site', async () => {
		const client = {
			isReady: vi.fn(async () => undefined),
		} as unknown as PlaygroundClient;
		const state = createState({
			activeSiteSlug: 'current',
			bootedSiteSlug: 'booted',
			client,
		});
		const dispatch = createDispatch(state);

		const api = createSitesAPI(() => state, dispatch);
		const result = await Promise.race([
			api
				.setActiveSite('booted', { updateUrl: false })
				.then(() => 'resolved' as const),
			new Promise<'timed-out'>((resolve) =>
				setTimeout(() => resolve('timed-out'), 0)
			),
		]);

		expect(result).toBe('resolved');
		expect(state.ui.activeSite?.slug).toBe('booted');
		expect(client.isReady).toHaveBeenCalledOnce();
	});

	it('still dispatches route updates when opening the already active site', async () => {
		const client = {
			isReady: vi.fn(async () => undefined),
		} as unknown as PlaygroundClient;
		const state = createState({
			activeSiteSlug: 'current',
			bootedSiteSlug: 'current',
			client,
		});
		const dispatch = createDispatch(state);

		const api = createSitesAPI(() => state, dispatch);
		await api.setActiveSite('current', { updateUrl: true });

		expect(mocks.setActiveSite).toHaveBeenCalledWith('current', {
			updateUrl: true,
		});
		expect(state.ui.activeSite?.slug).toBe('current');
		expect(client.isReady).toHaveBeenCalledOnce();
	});

	it('routes an active autosave to its saved-site URL when keeping it in browser', async () => {
		window.history.replaceState({}, '', '/?php=8.3');
		const client = {
			isReady: vi.fn(async () => undefined),
		} as unknown as PlaygroundClient;
		const state = createState({
			activeSiteSlug: 'autosave',
			bootedSiteSlug: 'autosave',
			client,
		});
		state.sites.entities.autosave!.metadata.persistence = 'autosave';
		const dispatch = createDispatch(state);

		const api = createSitesAPI(() => state, dispatch);
		await api.saveInBrowser('Kept autosave');

		expect(mocks.opfsSiteStorage.update).toHaveBeenCalledWith(
			'autosave',
			expect.objectContaining({ name: 'Kept autosave' }),
			undefined
		);
		expect(mocks.opfsSiteStorage.update).toHaveBeenCalledWith(
			'autosave',
			expect.objectContaining({ persistence: 'explicit' }),
			undefined
		);
		expect(window.location.search).toContain('site-slug=autosave');
	});
});

function createDispatch(state: PlaygroundReduxState) {
	const dispatch = vi.fn((action: unknown) => {
		if (typeof action === 'function') {
			return action(dispatch, () => state);
		}
		const reduxAction = action as { type?: string; payload?: string };
		if (reduxAction.type?.startsWith('sites/')) {
			state.sites = sitesReducer(state.sites, action as any);
		}
		if (reduxAction.type === 'ui/setActiveSite') {
			state.ui.activeSite = reduxAction.payload
				? {
						slug: reduxAction.payload,
						error: undefined,
						errorDetails: undefined,
					}
				: undefined;
		}
		return action;
	}) as unknown as PlaygroundDispatch;
	return dispatch;
}

function createState({
	activeSiteSlug,
	bootedSiteSlug,
	client,
}: {
	activeSiteSlug: string;
	bootedSiteSlug: string;
	client: PlaygroundClient;
}) {
	const sites = Array.from(new Set([activeSiteSlug, bootedSiteSlug])).map(
		(slug) => createSite(slug)
	);
	return {
		ui: {
			activeSite: {
				slug: activeSiteSlug,
				error: undefined,
				errorDetails: undefined,
			},
		},
		sites: {
			ids: sites.map((site) => site.slug),
			entities: Object.fromEntries(
				sites.map((site) => [site.slug, site])
			),
			opfsSitesLoadingState: 'loaded',
			firstTemporarySiteCreated: false,
		},
		clients: {
			ids: [bootedSiteSlug],
			entities: {
				[bootedSiteSlug]: {
					siteSlug: bootedSiteSlug,
					url: '/',
					client,
				},
			},
		},
	} as unknown as PlaygroundReduxState;
}

function createSite(slug: string) {
	return {
		slug,
		metadata: {
			id: slug,
			name: slug,
			storage: 'opfs',
			runtimeConfiguration: {},
			originalBlueprint: {},
			originalBlueprintSource: {
				type: 'literal',
			},
		},
	} as unknown as SiteInfo;
}
