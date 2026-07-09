import { renderToStaticMarkup } from 'react-dom/server';
import { getSiteErrorView } from './get-site-error-view';
import type { BlueprintSource } from '../../lib/state/url/resolve-blueprint-from-url';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';

const helpers = {
	deleteSite: () => {},
	reloadPage: () => {},
	restartWithoutPr: () => {},
	reloadWithoutBlueprint: () => {},
};

describe('getSiteErrorView', () => {
	it('shows the failed file URL for resource download errors', () => {
		const url =
			'https://downloads.wordpress.org/plugin/hello-dolly.latest-stable.zip';
		const view = getSiteErrorView({
			error: 'resource-download-failed',
			site: createSite(),
			helpers,
			errorDetails: {
				url,
			},
		});

		expect(renderToStaticMarkup(view.body)).toContain(url);
	});

	it('explains interrupted initial saves without storage jargon', () => {
		const view = getSiteErrorView({
			error: 'initial-opfs-sync-interrupted',
			site: createSite(),
			helpers,
		});

		expect(view.title).toBe('This Playground was not saved completely');
		expect(renderToStaticMarkup(view.body)).toContain(
			'before all files were copied'
		);
		expect(renderToStaticMarkup(view.body)).toContain(
			'Start a new Playground'
		);
		expect(renderToStaticMarkup(view.actions[0])).toContain(
			'Start a new Playground'
		);
	});

	it('uses browser-storage wording when pending cleanup cannot finish', () => {
		const view = getSiteErrorView({
			error: 'browser-storage-cleanup-failed',
			site: createSite(),
			helpers,
		});

		expect(view.title).toBe('Could not reopen this saved Playground');
		expect(renderToStaticMarkup(view.body)).toContain(
			'an earlier reset of this saved site was interrupted'
		);
		expect(renderToStaticMarkup(view.body)).toContain(
			'Click <strong>Try again</strong>'
		);
		expect(renderToStaticMarkup(view.actions[0])).toContain('Try again');
	});

	it('says when the entire Blueprint could not be downloaded', () => {
		const url = 'https://example.com/blueprint.json';
		const view = getSiteErrorView({
			error: 'blueprint-fetch-failed',
			site: createSite({
				type: 'remote-url',
				url,
			}),
			helpers,
		});

		expect(view.title).toBe('Blueprint could not be downloaded');
		expect(renderToStaticMarkup(view.body)).toContain(url);
	});
});

function createSite(
	originalBlueprintSource: BlueprintSource = { type: 'none' }
): SiteInfo {
	return {
		slug: 'test-site',
		metadata: {
			name: 'Test site',
			id: 'test-site',
			storage: 'none',
			originalBlueprint: {},
			originalBlueprintSource,
			runtimeConfiguration: {
				phpVersion: '8.3',
				wpVersion: 'latest',
				intl: false,
				networking: true,
				extraLibraries: [],
				constants: {},
			},
		},
	} as SiteInfo;
}
