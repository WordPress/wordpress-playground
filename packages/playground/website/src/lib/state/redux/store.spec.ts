// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { setActiveSite, type PlaygroundReduxState } from './store';
import type { SiteInfo } from './slice-sites';

describe('setActiveSite', () => {
	it('updates the URL even when the requested site is already active', () => {
		window.history.replaceState({}, '', '/?overlay=playgrounds');
		const site = createStoredSite('my-saved-playground');
		const state = {
			ui: {
				activeSite: {
					slug: site.slug,
					error: undefined,
					errorDetails: undefined,
				},
			},
			sites: {
				entities: {
					[site.slug]: site,
				},
			},
		} as unknown as PlaygroundReduxState;
		const dispatch = vi.fn();

		setActiveSite(site.slug)(dispatch as any, () => state);

		expect(window.location.search).toContain(
			'site-slug=my-saved-playground'
		);
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('clears a stale active slug when no site is selected anymore', () => {
		const state = {
			ui: {
				activeSite: {
					slug: 'deleted-site',
					error: undefined,
					errorDetails: undefined,
				},
			},
			sites: {
				entities: {},
			},
		} as unknown as PlaygroundReduxState;
		const dispatch = vi.fn();

		setActiveSite(undefined)(dispatch as any, () => state);

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({ payload: undefined })
		);
	});
});

function createStoredSite(slug: string) {
	return {
		slug,
		metadata: {
			id: slug,
			name: 'My saved Playground',
			storage: 'opfs',
			runtimeConfiguration: {},
			originalBlueprint: {},
			originalBlueprintSource: {
				type: 'literal',
			},
		},
	} as unknown as SiteInfo;
}
