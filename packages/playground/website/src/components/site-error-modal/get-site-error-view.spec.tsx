import { renderToStaticMarkup } from 'react-dom/server';
import { getSiteErrorView } from './get-site-error-view';
import type { BlueprintSource } from '../../lib/state/url/resolve-blueprint-from-url';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';

const helpers = {
	deleteSite: () => {},
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
