import {
	SupportedPHPVersions,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';

// We can't import the WordPress versions directly from the remote package because
// of ESModules vs CommonJS incompatibilities. Let's just import the JSON file
// directly.
// @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as SupportedWordPressVersions from '../../../wordpress/src/wordpress/wp-versions.json';
import { Blueprint } from '@wp-playground/blueprints';

const LatestSupportedWordPressVersion = Object.keys(
	SupportedWordPressVersions
).filter((x) => !['nightly', 'beta'].includes(x))[0];

describe('Query API', () => {
	describe('option `php`', () => {
		it('should load PHP 8.0 by default', () => {
			cy.visit('/?url=/phpinfo.php');
			cy.wordPressDocument()
				.find('h1', {
					timeout: 60_000,
				})
				.should('contain', 'PHP Version 8.0');
		});

		it('should load PHP 7.4 when requested', () => {
			cy.visit('/?php=7.4&url=/phpinfo.php');
			cy.wordPressDocument()
				.find('h1', {
					timeout: 60_000,
				})
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
			cy.visit('/?wp=6.3&url=/wp-admin');
			cy.wordPressDocument().find(`body.branch-6-3`).should('exist');
		});
	});

	describe('option `php-extension-bundle`', () => {
		it('should load the specified PHP extensions', () => {
			cy.visit('/?php-extension-bundle=kitchen-sink&url=/phpinfo.php');
			cy.wordPressDocument()
				.its('body')
				.should('contain', '--enable-xmlwriter');
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
				.find('[data-slug=gutenberg].active', {
					// This might take a while on GitHub CI
					// @TODO: Measure whether there's a significant slowdown
					//        coming from switching to the CompressionStream API
					timeout: 60_000,
				})
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
				.get('#wp-admin-bar-my-sites')
				.should('contain', 'My Sites');
		});
	});

	describe('option `lazy`', () => {
		it('should defer loading the Playground assets until someone clicks on the "Run" button', () => {
			cy.visit('/?lazy');
			cy.get('#lazy-load-initiator').should('exist');
			cy.get('#playground-viewport').should('not.exist');

			cy.get('#lazy-load-initiator').click();
			cy.get('#playground-viewport').should('exist');
			cy.wordPressDocument().its('body').should('have.class', 'home');
		});
	});

	describe('option `storage`', () => {
		describe('storage=none', () => {
			it('should reset Playground data after every refresh', () => {
				// Create a Playground site with a custom title
				cy.visit(
					'/?storage=none#{"siteOptions":{"blogname":"persistent storage"}}'
				);
				cy.wordPressDocument().its('body').should('have.class', 'home');
				cy.wordPressDocument()
					.its('body')
					.should('contain', 'persistent storage');

				// Reload the page and verify that the title is not there anymore
				cy.visit('/?storage=none');
				cy.wordPressDocument().its('body').should('have.class', 'home');
				cy.wordPressDocument()
					.its('body')
					.should('not.contain', 'persistent storage');
			});
		});
		describe('storage=browser', () => {
			it('should store the Playground data in the browser', () => {
				// Create a Playground site with a custom title
				cy.visit(
					'/?storage=browser#{"siteOptions":{"blogname":"persistent storage"}}'
				);
				cy.wordPressDocument().its('body').should('have.class', 'home');
				cy.wordPressDocument()
					.its('body')
					.should('contain', 'persistent storage');

				// Reload the page and verify that the title is still there
				cy.visit('/?storage=browser');
				cy.wordPressDocument().its('body').should('have.class', 'home');
				cy.wordPressDocument()
					.its('body')
					.should('contain', 'persistent storage');
			});
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

		it('should patch Gutenberg brought over by importing a site', () => {
			cy.visit('/');
			// Get the current URL
			cy.url().then((url) => {
				url = url.replace(/\/$/, '');
				// Import a site that has Gutenberg installed
				cy.visit(
					`/?import-site=${url}/test-fixtures/site-with-unpatched-gutenberg.zip&url=/wp-admin/post-new.php`
				);
				checkIfGutenbergIsPatched();
			});
		});

		function checkIfGutenbergIsPatched() {
			// Check if the inserter button is styled.
			// If Gutenberg wasn't correctly patched,
			// the inserter will look like a default
			// browser button.
			cy.wordPressDocument()
				.find('iframe[name="editor-canvas"]', {
					timeout: 60_000,
				})
				.its('0.contentDocument')
				.find('.block-editor-inserter__toggle')
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

describe('Playground service worker UI', () => {
	beforeEach(() => cy.visit('/?networking=no'));

	it('should resolve nice permalinks (/%postname%/)', () => {
		const blueprint = {
			landingPage: '/sample-page/',
			siteOptions: { permalink_structure: '/%postname%/' },
		};
		cy.visit('/#' + encodeURIComponent(JSON.stringify(blueprint)));
		cy.wordPressDocument().its('body').should('have.class', 'page');
		cy.wordPressDocument()
			.get('#wp-block-post-title')
			.should('contain', 'Sample Page');
	});
});

describe('Blueprints', () => {
	it('enableMultisite step should enable a multisite', () => {
		const blueprint: Blueprint = {
			landingPage: '/',
			steps: [{ step: 'enableMultisite' }],
		};
		cy.visit('/#' + encodeURIComponent(JSON.stringify(blueprint)));
		cy.wordPressDocument()
			.get('#wp-admin-bar-my-sites')
			.should('contain', 'My Sites');
	});
	it('enableMultisite step should re-activate the importer plugin', () => {
		const blueprint: Blueprint = {
			landingPage: '/wp-admin/plugins.php',
			steps: [{ step: 'enableMultisite' }],
		};
		cy.visit('/#' + encodeURIComponent(JSON.stringify(blueprint)));
		cy.wordPressDocument()
			.get(
				'true.active[data-plugin="wordpress-importer/wordpress-importer.php"]'
			)
			.should('exist');
	});
});

describe('Playground website UI', () => {
	beforeEach(() => cy.visit('/?networking=no'));

	it('should reflect the URL update from the navigation bar in the WordPress site', () => {
		cy.setWordPressUrl('/wp-admin');
		cy.wordpressPath().should('contain', '/wp-admin');
	});

	// Test all PHP versions for completeness
	describe('PHP version switcher', () => {
		SupportedPHPVersions.forEach((version) => {
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
