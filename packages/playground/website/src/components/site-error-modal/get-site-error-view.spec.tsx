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

		expect(view.title).toBe('Start a new Playground to continue');
		expect(renderToStaticMarkup(view.body)).toContain(
			'This saved Playground is incomplete and can’t be reopened'
		);
		expect(renderToStaticMarkup(view.body)).toContain(
			'the previous save stopped before all WordPress files were copied'
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

		expect(view.title).toBe('Close other Playground tabs, then reload');
		expect(renderToStaticMarkup(view.body)).toContain(
			'An earlier reset was interrupted, and old site files are'
		);
		expect(renderToStaticMarkup(view.body)).toContain(
			'Playground tried to remove those old files again before'
		);
		expect(renderToStaticMarkup(view.body)).toContain(
			'may show the old site instead of the reset site'
		);
		expect(renderToStaticMarkup(view.body)).toContain(
			'click <strong>Reload</strong>'
		);
		expect(renderToStaticMarkup(view.actions[0])).toContain('Reload');
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

	it('explains an incomplete WordPress download and offers a retry', () => {
		const view = getSiteErrorView({
			error: 'site-boot-failed',
			site: createSite(),
			helpers,
			errorDetails: {
				originalErrorClassName: 'WordPressBundleFileCountMismatchError',
			},
		});

		expect(view.title).toBe('WordPress download was incomplete');
		expect(renderToStaticMarkup(view.body)).toContain(
			'the downloaded WordPress package was missing files'
		);
		expect(renderToStaticMarkup(view.actions[0])).toContain(
			'Reload and try again'
		);
		expect(view.hideReportButton).toBe(true);
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
