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
		inIframeBody(selector: string, callback: Function): void;
		inWordPressIframe(callback: Function): void;
		setWordPressUrl(url: string): void;
		waitForWordPress(url?: string): void;
	}
}

Cypress.Commands.add('getIframeBody', (iframeSelector: string) => {
	return cy
		.get(iframeSelector)
		.its('0.contentDocument.body')
		.should('not.be.empty')
		.then(cy.wrap) as Cypress.Chainable<Element>;
});

Cypress.Commands.add('inIframeBody', (selector: string, callback: Function) => {
	cy.getIframeBody(selector).should('exist');
	cy.getIframeBody(selector).within(callback as any);
});

Cypress.Commands.add('inRemoteIframe', (callback: Function) => {
	cy.inIframeBody('iframe#playground-viewport', callback);
});

Cypress.Commands.add('inWordPressIframe', (callback: Function) => {
	cy.waitForWordPress();
	cy.inIframeBody('iframe#playground-viewport', () => {
		// For some reason we need to wait a few ms here, even
		// though Cypress should be waiting for the iframe to load
		// eslint-disable-next-line cypress/no-unnecessary-waiting
		// cy.wait(50);
		cy.inIframeBody('iframe#wp', callback);
	});
});

Cypress.Commands.add('waitForWordPress', (expectedUrl?: string) => {
	// Wait for WordPress iframe to change src
	cy.inRemoteIframe(() => {
		// cy.get('iframe#wp').should('have.attr', 'src');
		// if (expectedUrl !== undefined) {
		// 	cy.get('iframe#wp')
		// 		.invoke('attr', 'src')
		// 		.should((actualUrl) => {
		// 			const pathname = new URL(actualUrl + '').pathname;
		// 			expect(pathname).to.match(
		// 				new RegExp(
		// 					`(/scope:0\\.\\d+)?${escapeRegExp(expectedUrl)}`
		// 				)
		// 			);
		// 		});
		// }
	});
	// Wait for the WordPress document to load
	cy.inWordPressIframe(() => {
		cy.document().should('exist');
	});
});

Cypress.Commands.add('setWordPressUrl', (url: string) => {
	cy.get('input[name=url]').should('be.visible').type(url);
	cy.get('input[name=url]').type('{enter}');

	cy.waitForWordPress(url);
});

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
