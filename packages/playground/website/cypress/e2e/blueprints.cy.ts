import { Blueprint } from '@wp-playground/blueprints';

describe('Blueprints', () => {
	it('should resolve nice permalinks (/%postname%/)', () => {
		cy.visit(
			'/#' +
				JSON.stringify({
					landingPage: '/sample-page/',
					steps: [
						{
							step: 'setSiteOptions',
							options: {
								permalink_structure: '/%25postname%25/', // %25 is escaped "%"
							},
						},
						{
							step: 'runPHP',
							code: `<?php 
					require '/wordpress/wp-load.php'; 
					$wp_rewrite->flush_rules();
				`,
						},
						{
							step: 'setSiteOptions',
							options: {
								blogname: 'test',
							},
						},
					],
				})
		);
		cy.wordPressDocument().its('body').should('have.class', 'page');
		cy.wordPressDocument().its('body').should('contain', 'Sample Page');
	});

	it('enableMultisite step should enable a multisite', () => {
		const blueprint: Blueprint = {
			landingPage: '/',
			steps: [{ step: 'enableMultisite' }],
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument().its('body').should('contain.text', 'My Sites');
	});
	it('enableMultisite step should re-activate the importer plugin', () => {
		const blueprint: Blueprint = {
			landingPage: '/wp-admin/plugins.php',
			steps: [{ step: 'enableMultisite' }],
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument()
			.its('body')
			.get(
				'.active[data-plugin="wordpress-importer/wordpress-importer.php"]'
			)
			.should('exist');
	});
});
