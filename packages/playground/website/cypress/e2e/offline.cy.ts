const goOffline = () => {
	return Cypress.automation('remote:debugger:protocol', {
		command: 'Network.emulateNetworkConditions',
		params: {
			offline: true,
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
 * Firefox support currently doesn't work https://github.com/WordPress/wordpress-playground/issues/1645
 * We need to remove `browser: '!firefox'` when #1645 is fixed.
 */
describe(
	'Offline mode',
	{ browser: '!firefox', env: { NODE_ENV: 'production' } },
	() => {
		describe('Playground should load the website in offline mode', () => {
			// preload the website to make sure the service worker is registered and cache is populated
			beforeEach(() => {
				cy.visit('/?login=yes');
				cy.window().then((win) => {
					if ('serviceWorker' in navigator) {
						return win.navigator.serviceWorker.getRegistration();
					}
					throw new Error('Service Worker not supported');
				});
			});
			it('should load the website in offline mode', () => {
				goOffline();
				cy.visit('/?login=yes');
				cy.wordPressDocument()
					.find('#wp-admin-bar-site-name > a')
					.should('contain', 'My WordPress Website');
			});
		});
	}
);
