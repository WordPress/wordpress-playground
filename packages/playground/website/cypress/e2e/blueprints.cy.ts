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

	it('Landing page without the initial slash should work', () => {
		const blueprint: Blueprint = {
			landingPage: 'wp-admin/plugins.php',
			login: true,
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument().its('body').should('contain.text', 'Plugins');
	});

	it('enableMultisite step should enable a multisite', () => {
		const blueprint: Blueprint = {
			landingPage: '/',
			steps: [{ step: 'enableMultisite' }],
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument().its('body').should('contain.text', 'My Sites');
	});

	it('Base64-encoded Blueprints should work', () => {
		const blueprint: Blueprint = {
			landingPage: '/',
			steps: [{ step: 'enableMultisite' }],
		};
		cy.visit('/#' + btoa(JSON.stringify(blueprint)));
		cy.wordPressDocument().its('body').should('contain.text', 'My Sites');
	});

	it('enableMultisite step should re-activate the plugins', () => {
		const blueprint: Blueprint = {
			landingPage: '/wp-admin/plugins.php',
			plugins: ['hello-dolly'],
			steps: [{ step: 'enableMultisite' }],
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument()
			.its('body')
			.find('[data-slug="hello-dolly"].active')
			.should('exist');
	});

	it('wp-cli step should create a post', () => {
		const blueprint: Blueprint = {
			landingPage: '/wp-admin/post.php',
			login: true,
			steps: [
				{
					step: 'wp-cli',
					command:
						"wp post create --post_title='Test post' --post_excerpt='Some content' --no-color",
				},
			],
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument()
			.its('body')
			.find('[aria-label="“Test post” (Edit)"]')
			.should('exist');
	});

	it('PHP Shutdown should work', () => {
		const blueprint: Blueprint = {
			landingPage: '/wp-admin/',
			features: { networking: true },
			steps: [
				{ step: 'login' },
				{
					step: 'writeFile',
					path: '/wordpress/wp-content/mu-plugins/rewrite.php',
					data: "<?php add_action( 'shutdown', function() { post_message_to_js('test'); } );",
				},
			],
		};
		cy.visit('/#' + JSON.stringify(blueprint));
		cy.wordPressDocument().its('body').should('contain', 'Dashboard');
	});
});
