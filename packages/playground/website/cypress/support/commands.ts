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
		setWordPressUrl(url: string): void;
		wordPressDocument(): Chainable<Element>;
		wordpressPath(): Chainable<string>;
		relativeUrl(): Chainable<string>;
	}
}

Cypress.Commands.add('setWordPressUrl', (url: string) => {
	cy.get('input[name=url]').should('be.visible').type(url);
	cy.get('input[name=url]').type('{enter}');
});

Cypress.Commands.add('wordPressDocument', () => {
	cy.get('.playground-viewport:visible').should('exist');
	cy.get('.playground-viewport:visible')
		.its('0.contentDocument')
		.find('#wp')
		.should('exist');
	return cy
		.get('.playground-viewport:visible')
		.its('0.contentDocument')
		.find('#wp')
		.its('0.contentDocument');
});

Cypress.Commands.add('wordpressPath', () => {
	return cy
		.get('.playground-viewport:visible')
		.its('0.contentDocument')
		.find('#wp')
		.its('0.contentWindow.location.pathname');
});

Cypress.Commands.add('relativeUrl', () => {
	// relative part of the current top-level URL
	return cy.url().then((href) => {
		const url = new URL(href);
		console.log({ href });
		return href.substring(url.origin.length);
	});
});
