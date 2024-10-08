// We can't import the WordPress versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

const LatestSupportedWordPressVersion = Object.keys(
	MinifiedWordPressVersions
).filter((x) => !['nightly', 'beta'].includes(x))[0];

describe('Query API', () => {
	describe('option `php`', () => {
		it('should load PHP 8.0 by default', () => {
			cy.visit('/?url=/phpinfo.php');
			cy.wordPressDocument()
				.find('h1')
				.should('contain', 'PHP Version 8.0');
		});

		it('should load PHP 7.4 when requested', () => {
			cy.visit('/?php=7.4&url=/phpinfo.php');
			cy.wordPressDocument()
				.find('h1')
				.should('contain', 'PHP Version 7.4');
		});
	});

	describe('option `wp`', () => {
		it('should load WordPress latest by default', () => {
			cy.visit('/?url=/wp-admin/');
			const expectedBodyClass =
				'branch-' + LatestSupportedWordPressVersion.replace('.', '-');
			cy.wordPressDocument()
				.find(`body.${expectedBodyClass}`)
				.should('exist');
		});

		it('should load WordPress 6.3 when requested', () => {
			cy.visit('/?wp=6.3&url=/wp-admin/');
			cy.wordPressDocument().find(`body.branch-6-3`).should('exist');
		});
	});

	describe('option `networking`', () => {
		it('should disable networking when requested', () => {
			cy.visit('/?url=/wp-admin/plugin-install.php');
			cy.wordPressDocument()
				.find('.notice.error')
				.should(
					'contain',
					'Network access is an experimental, opt-in feature'
				);
		});

		it('should enable networking when requested', () => {
			cy.visit('/?networking=yes&url=/wp-admin/plugin-install.php');
			cy.wordPressDocument()
				.find('.plugin-card')
				.should('have.length.above', 4);
		});

		/**
		 * @see https://github.com/WordPress/wordpress-playground/pull/819
		 * @TODO: Turn this into a unit test once WordPress modules are available
		 *        for import.
		 */
		it('should return true from wp_http_supports(array( "ssl" ))', () => {
			const blueprint = {
				landingPage: '/test.php',
				features: {
					networking: true,
				},
				steps: [
					{
						step: 'writeFile',
						path: '/wordpress/test.php',
						data: `<?php
						require("/wordpress/wp-load.php");
						echo wp_http_supports(array( "ssl" )) ? "true" : "false";
						`,
					},
				],
			};
			cy.visit('/#' + JSON.stringify(blueprint));
			cy.wordPressDocument().its('body').should('contain', 'true');
		});
	});

	describe('option `plugin`', () => {
		it('should install the specified plugin', () => {
			cy.visit('/?plugin=gutenberg&url=/wp-admin/plugins.php');
			cy.wordPressDocument()
				.find('[data-slug=gutenberg].active')
				.should('exist');
		});
	});

	describe('option `theme`', () => {
		it('should install the specified theme', () => {
			cy.visit('/?theme=twentytwentyone&url=/wp-admin/themes.php');
			cy.wordPressDocument()
				.find('[data-slug=twentytwentyone].active')
				.should('exist');
		});
	});

	describe('option `url`', () => {
		it('should load the specified URL', () => {
			cy.visit('/?url=/wp-admin/');
			cy.wordpressPath().should('contain', '/wp-admin/');
			cy.wordPressDocument()
				.find('#adminmenu')
				.should('contain', 'Dashboard');
		});
	});

	describe('option `mode`', () => {
		it('lack of mode=seamless should a WordPress in a simulated browser UI', () => {
			cy.visit('/');
			cy.get('[data-cy="simulated-browser"]').should('exist');
		});
		it('mode=seamless should load a fullscreen WordPress', () => {
			cy.visit('/?mode=seamless');
			cy.get('[data-cy="simulated-browser"]').should('not.exist');
		});
	});

	describe('option `login`', () => {
		it('should log the user in as an admin', () => {
			cy.visit('/');
			cy.wordPressDocument()
				.its('body')
				.should('have.class', 'logged-in');
		});

		it('should not log the user in as an admin when not requested', () => {
			cy.visit('/?login=no');
			cy.wordPressDocument()
				.its('body')
				.should('not.have.class', 'logged-in');
		});
	});

	describe('option `multisite`', () => {
		it('should enable a multisite', () => {
			cy.visit('/?multisite=yes');
			cy.wordPressDocument()
				.its('body')
				.should('contain.text', 'My Sites');
		});
	});

	describe('option `lazy`', () => {
		it('should defer loading the Playground assets until someone clicks on the "Run" button', () => {
			cy.visit('/?lazy');
			cy.get('#lazy-load-initiator').should('exist');
			cy.get('.playground-viewport').should('not.exist');

			cy.get('#lazy-load-initiator').click();
			cy.get('.playground-viewport').should('exist');
			cy.wordPressDocument().its('body').should('have.class', 'home');
		});
	});

	describe('Patching Gutenberg editor frame', () => {
		it('should patch the editor frame in WordPress', () => {
			cy.visit('/?plugin=gutenberg&url=/wp-admin/post-new.php');
			checkIfGutenbergIsPatched();
		});

		it('should patch the editor frame in Gutenberg when it is installed as a plugin', () => {
			cy.visit('/?plugin=gutenberg&url=/wp-admin/post-new.php');
			checkIfGutenbergIsPatched();
		});

		// it('should patch Gutenberg brought over by importing a site', () => {
		// 	cy.visit('/');
		// 	// Get the current URL
		// 	cy.url().then((url) => {
		// 		url = url.replace(/\/$/, '');
		// 		// Import a site that has Gutenberg installed
		// 		cy.visit(
		// 			`/?import-site=${url}/test-fixtures/site-with-unpatched-gutenberg.zip&url=/wp-admin/post-new.php`
		// 		);
		// 		checkIfGutenbergIsPatched();
		// 	});
		// });

		function checkIfGutenbergIsPatched() {
			// Check if the inserter button is styled.
			// If Gutenberg wasn't correctly patched,
			// the inserter will look like a default
			// browser button.
			cy.wordPressDocument()
				.find('iframe[name="editor-canvas"]', {
					// Give GitHub CI plenty of time
					timeout: 60000 * 10,
				})
				.its('0.contentDocument')
				.find('.block-editor-inserter__toggle', {
					// Give GitHub CI plenty of time
					timeout: 60000 * 10,
				})
				.should('not.have.css', 'background-color', undefined);
		}
	});
});

// Let's disable this test in GitHub actions.
// The browser process crashes there, presumably to insufficient
// memory for the purposes of the readFile() line.
if (!Cypress.env('CI')) {
	describe('Playground import/export to zip', () => {
		it('should export a zipped wp-content directory when the "Download as .zip" button is clicked', () => {
			cy.visit('/');
			// Wait for the Playground to finish loading
			cy.wordPressDocument().its('body').should('exist');

			cy.get('[data-cy="dropdown-menu"]').click();
			cy.get('[data-cy="download-as-zip"]').click();
			const downloadsFolder = Cypress.config('downloadsFolder');
			cy.readFile(downloadsFolder + '/wordpress-playground.zip').should(
				'have.length.above',
				1000
			);
		});

		it('should import a previously exported wp-content directory when the "Restore from .zip" feature is used', () => {
			cy.visit(
				'/#{"siteOptions":{"blogname":"Cypress tests – site title"}}'
			);

			// Wait for the Playground to finish loading
			cy.wordPressDocument()
				.its('body')
				.should('contain', 'Cypress tests – site title');

			// Download a zip file
			const downloadsFolder = Cypress.config('downloadsFolder');
			cy.get('[data-cy="dropdown-menu"]').click();
			cy.get('[data-cy="download-as-zip"]').click();
			cy.readFile(downloadsFolder + '/wordpress-playground.zip').should(
				'have.length.above',
				1000
			);

			// Reload the page
			cy.visit('/?cy-reloaded');
			cy.url().should('match', /\?cy-reloaded/);
			cy.get('input[name=url]').should('be.visible');
			cy.wordPressDocument()
				.its('body')
				.should('not.contain', 'Cypress tests – site title');

			// Import the zip file
			cy.get('[data-cy="dropdown-menu"]').click();
			cy.get('[data-cy="restore-from-zip"]').click();
			cy.get('#import-select-file').selectFile(
				`${downloadsFolder}/wordpress-playground.zip`
			);
			cy.get('#import-submit--btn').click();

			// Wait for the Playground to reload
			cy.wordPressDocument().its('body').should('exist');

			// Confirm the site title is the one we exported
			cy.wordPressDocument()
				.its('body')
				.should('contain', 'Cypress tests – site title');
		});
	});
}
