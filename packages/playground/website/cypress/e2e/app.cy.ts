import {
	SupportedPHPVersions,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';

// @ts-ignore
import * as SupportedWordPressVersions from '../../../remote/src/wordpress/wp-versions.json';

describe('playground-website', () => {
	beforeEach(() => cy.visit('/?networking=no'));

	it('should reflect the URL update from the navigation bar in the WordPress site', () => {
		cy.setWordPressUrl('/wp-admin');
		cy.inRemoteIframe(() => {
			cy.get('iframe#wp')
				.should('have.attr', 'src')
				.and('match', /\/wp-admin\/?$/);
		});
	});

	// Test all PHP versions for completeness
	SupportedPHPVersions.forEach((version) => {
		it('should switch PHP version to ' + version, () => {
			// Update settings in Playground configurator
			cy.get('button#configurator').click();
			cy.get('select#php-version').select(version);
			cy.get('#modal-content button[type=submit]').click();
			// Wait for the page to finish loading
			cy.document().should('exist');

			// Go to phpinfo
			cy.setWordPressUrl('/phpinfo.php');
			cy.inWordPressIframe(() => {
				cy.get('h1').should('contain', 'PHP Version ' + version);
			});
		});
	});

	// Only test the latest PHP version to save time
	it('should load additional PHP extensions when requested', () => {
		// Update settings in Playground configurator
		cy.get('button#configurator').click();
		cy.get('select#php-version').select(LatestSupportedPHPVersion);
		cy.get('input[name=with-extensions]').check();
		cy.get('#modal-content button[type=submit]').click();
		// Wait for the page to finish loading
		cy.document().should('exist');

		// Go to phpinfo
		cy.setWordPressUrl('/phpinfo.php');
		cy.inWordPressIframe(() => {
			cy.get('td.v').should('contain', '--enable-xmlwriter');
		});
	});

	it('should not load additional PHP extensions when not requested', () => {
		// Update settings in Playground configurator
		cy.get('button#configurator').click();
		cy.get('select#php-version').select(LatestSupportedPHPVersion);
		cy.get('#modal-content button[type=submit]').click();
		// Wait for the page to finish loading
		cy.document().should('exist');

		// Go to phpinfo
		cy.setWordPressUrl('/phpinfo.php');
		cy.inWordPressIframe(() => {
			cy.get('td.v').should('contain', '--without-libxml');
		});
	});

	// Test all WordPress versions for completeness
	for (const version in SupportedWordPressVersions) {
		if (version === 'beta') {
			continue;
		}
		// @ts-ignore
		let versionMessage = 'Version ' + version;
		if (version === 'nightly') {
			versionMessage = 'You are using a development version';
		}

		it('should switch WordPress version to ' + version, () => {
			// Update settings in Playground configurator
			cy.get('button#configurator').click();
			cy.get(`select#wp-version option[value="${version}"]`).should(
				'exist'
			);
			cy.get('select#wp-version').select(`${version}`);
			cy.get('#modal-content button[type=submit]').click();
			// Wait for the page to finish loading
			cy.url().should('contain', `&wp=${version}`);

			// Go to phpinfo
			cy.setWordPressUrl('/wp-admin');
			cy.inWordPressIframe(() => {
				cy.get('#footer-upgrade').should('exist');
				cy.get('#footer-upgrade').should('contain', versionMessage);
			});
		});
	}
});
