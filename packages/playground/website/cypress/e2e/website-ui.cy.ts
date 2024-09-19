import { Blueprint } from '@wp-playground/blueprints';

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
