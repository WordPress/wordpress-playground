import {
	SupportedPHPVersions,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';

// We can't import the WordPress versions directly from the remote package because
// of ESModules vs CommonJS incompatibilities. Let's just import the JSON file
// directly.
// @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';
import { Blueprint } from '@wp-playground/blueprints';

describe('Playground website UI', () => {
	beforeEach(() => cy.visit('/?networking=no'));

	it('should reflect the URL update from the navigation bar in the WordPress site', () => {
		cy.setWordPressUrl('/wp-admin');
		cy.wordpressPath().should('contain', '/wp-admin');
	});

	// Test all PHP versions for completeness
	describe('PHP version switcher', () => {
		SupportedPHPVersions.forEach((version) => {
			/**
			 * WordPress 6.6 dropped support for PHP 7.0 and 7.1 so we need to skip these versions.
			 * @see https://make.wordpress.org/core/2024/04/08/dropping-support-for-php-7-1/
			 */
			if (['7.0', '7.1'].includes(version)) {
				return;
			}
			it('should switch PHP version to ' + version, () => {
				// Update settings in Playground configurator
				cy.get('button#configurator').click();
				cy.get('select#php-version').select(version);
				cy.get('#modal-content button[type=submit]').click();
				// Wait for the page to finish reloading
				cy.url().should('contain', `php=${version}`);
				cy.document().should('exist');

				// Go to phpinfo
				cy.setWordPressUrl('/phpinfo.php');
				cy.wordPressDocument()
					.find('h1')
					.should('contain', 'PHP Version ' + version);
			});
		});
	});

	// Only test the latest PHP version to save time
	describe('PHP extensions bundle', () => {
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
			cy.wordPressDocument()
				.its('body')
				.should('contain', '--enable-xmlwriter');
		});

		it('should not load additional PHP extensions when not requested', () => {
			// Update settings in Playground configurator
			cy.get('button#configurator').click();
			cy.get('select#php-version').select(LatestSupportedPHPVersion);
			cy.get('input[name=with-extensions]').uncheck();
			cy.get('#modal-content button[type=submit]').click();
			// Wait for the page to finish loading
			cy.document().should('exist');

			// Go to phpinfo
			cy.setWordPressUrl('/phpinfo.php');
			cy.wordPressDocument()
				.its('body')
				.should('contain', '--without-libxml');
		});
	});

	// Test all WordPress versions for completeness
	describe('WordPress version selector', () => {
		for (const version in MinifiedWordPressVersions) {
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
				cy.wordPressDocument()
					.find('#footer-upgrade')
					.should('contain', versionMessage);
			});
		}
	});
});

/**
 * These tests only check if the modal UI updates the URL correctly.
 * The actual networking functionality is tested in the Query API tests.
 */
describe('Website UI – Networking support', () => {
	it('should display an unchecked networking checkbox by default', () => {
		cy.visit('/');

		cy.get('button#configurator').click();
		cy.get('input[name=with-networking]').should('not.be.checked');
	});

	it('should display a checked networking checkbox when networking is enabled', () => {
		cy.visit('/?networking=yes');

		cy.get('button#configurator').click();
		cy.get('input[name=with-networking]').should('be.checked');
	});

	it('should display PHP output even when a fatal error is hit', () => {
		const blueprint: Blueprint = {
			landingPage: '/err.php',
			login: true,
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/err.php',
					data: "<?php throw new Exception('This is a fatal error'); \n",
				},
			],
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument()
			.its('body')
			.should('contain.text', 'This is a fatal error');
	});

	it('should enable networking when requested', () => {
		cy.visit('/');

		// Update settings in Playground configurator
		cy.get('button#configurator').click();
		cy.get('input[name=with-networking]').check();
		cy.get('#modal-content button[type=submit]').click();

		// Wait for the page to reload
		cy.document().should('exist');
		cy.get('#modal-content button[type=submit]').should('not.exist');

		// Confirm the URL was updated correctly
		cy.relativeUrl().should('contain', 'networking=yes');
	});

	it('should disable networking when requested', () => {
		cy.visit('/?networking=yes');

		// Update settings in Playground configurator
		cy.get('button#configurator').click();
		cy.get('input[name=with-networking]').uncheck();
		cy.get('#modal-content button[type=submit]').click();

		// Wait for the page to reload
		cy.document().should('exist');
		cy.get('#modal-content button[type=submit]').should('not.exist');

		// Confirm the URL was updated correctly
		cy.relativeUrl().should('not.contain', 'networking=yes');
	});
});
