/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface Chainable<Subject> {
		getIframeBody(selector: string): Chainable<Element>;
		inRemoteIframe(
			callback: (wordPressiFrame: Chainable<Element>) => void
		): void;
		inWordPressIframe(callback: Function): void;
		setWordPressUrl(url: string): void;
	}
}

Cypress.Commands.add('getIframeBody', (iframeSelector: string) => {
	return cy
		.get(iframeSelector)
		.its('0.contentDocument.body')
		.should('not.be.empty')
		.then(cy.wrap) as Cypress.Chainable<Element>;
});

Cypress.Commands.add('inRemoteIframe', (callback: Function) => {
	cy.getIframeBody('iframe#playground-viewport').should('exist');
	cy.getIframeBody('iframe#playground-viewport').within(() => {
		callback();
	});
});

Cypress.Commands.add('inWordPressIframe', (callback: Function) => {
	cy.inRemoteIframe(() => {
		cy.getIframeBody('iframe#wp').should('exist');
		cy.getIframeBody('iframe#wp').within(() => {
			cy.document().should('exist');
			// For some reason we need to wait a few ms here, even
			// though Cypress should be waiting for the iframe to load
			// eslint-disable-next-line cypress/no-unnecessary-waiting
			cy.wait(50);
			callback();
		});
	});
});

Cypress.Commands.add('setWordPressUrl', (url: string) => {
	cy.get('input[name=url]').should('be.visible').type(url);
	cy.get('input[name=url]').type('{enter}');
	// Wait for WordPress to reload
	cy.inWordPressIframe(() => {
		cy.document().should('exist');
	});
});
