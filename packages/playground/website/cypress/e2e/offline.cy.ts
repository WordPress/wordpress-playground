const assertOffline = () => {
	return cy.wrap(window).its('navigator.onLine').should('be.false');
};

const goOffline = () => {
	Cypress.automation('remote:debugger:protocol', {
		command: 'Network.enable',
	}).then(() => {
		return Cypress.automation('remote:debugger:protocol', {
			command: 'Network.emulateNetworkConditions',
			params: {
				offline: true,
				latency: -1,
				downloadThroughput: -1,
				uploadThroughput: -1,
			},
		});
	});
};

const goOnline = () => {
	// https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-emulateNetworkConditions
	Cypress.automation('remote:debugger:protocol', {
		command: 'Network.emulateNetworkConditions',
		params: {
			offline: false,
			latency: -1,
			downloadThroughput: -1,
			uploadThroughput: -1,
		},
	});
};

/**
 * We need to skip these tests in development mode because offline mode works
 * only in a production like environment.
 * Vite prevents us from caching files correctly in development mode.
 *
 * Since we are using Chrome debugger protocol API
 * we should only run these tests when NOT in Firefox browser
 * see https://on.cypress.io/configuration#Test-Configuration
 */
describe(
	'Offline mode',
	{ browser: '!firefox', env: { NODE_ENV: 'production' } },
	() => {
		describe('Playground should load the website', () => {
			before(() => cy.visit('/'));

			beforeEach(() => {
				goOffline();
				assertOffline();
				cy.visit('/?login=yes');
			});
			afterEach(goOnline);

			it('should load the website', () => {
				cy.setWordPressUrl('/');
				cy.wordPressDocument()
					.find('#wp-admin-bar-site-name > a')
					.should('contain', 'My WordPress Website');
			});

			it('should load wp-admin', () => {
				cy.setWordPressUrl('/wp-admin/');
				cy.wordPressDocument()
					.find('body.wp-admin h1')
					.should('contain', 'Dashboard');
			});

			it('should load preloaded remote WordPress assets', () => {
				/**
				 * The boot process preloads remote WordPress assets when offline.
				 * See `backfillStaticFilesRemovedFromMinifiedBuild`.
				 *
				 * `admin-bar.min.css` is one of these files, so we us it to determine if
				 * the preloading worked.
				 */
				cy.intercept('GET', '**/wp-includes/css/admin-bar.min.css*').as(
					'staticAsset'
				);
				cy.setWordPressUrl('/wp-admin/');
				cy.wait('@staticAsset')
					.its('response.statusCode')
					// 304 means returned from cache
					.should('eq', 304);
			});
		});
	}
);
