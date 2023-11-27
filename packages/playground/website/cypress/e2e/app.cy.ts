import {
	SupportedPHPVersions,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';

// We can't import the WordPress versions directly from the remote package because
// of ESModules vs CommonJS incompatibilities. Let's just import the JSON file
// directly.
// @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as SupportedWordPressVersions from '../../../remote/src/wordpress/wp-versions.json';

const LatestSupportedWordPressVersion = Object.keys(
	SupportedWordPressVersions
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
			cy.visit('/?networking=no&url=/wp-admin/');
			const expectedBodyClass =
				'branch-' + LatestSupportedWordPressVersion.replace('.', '-');
			cy.wordPressDocument()
				.find(`body.${expectedBodyClass}`)
				.should('exist');
		});

		it('should load WordPress 6.3 when requested', () => {
			cy.visit('/?networking=no&wp=6.3&url=/wp-admin');
			cy.wordPressDocument().find(`body.branch-6-3`).should('exist');
		});
	});

	describe('option `php-extension-bundle`', () => {
		it('should load the specified PHP extensions', () => {
			cy.visit(
				'/?networking=no&php-extension-bundle=kitchen-sink&url=/phpinfo.php'
			);
			cy.wordPressDocument()
				.its('body')
				.should('contain', '--enable-xmlwriter');
		});
	});

	describe('option `networking`', () => {
		it('should disable networking when requested', () => {
			cy.visit('/?networking=no&url=/wp-admin/plugin-install.php');
			cy.wordPressDocument()
				.find('.notice.error')
				.should(
					'contain',
					'does not yet support connecting to the plugin directory'
				);
		});

		it('should enable networking when requested', () => {
			cy.visit('/?networking=yes&url=/wp-admin/plugin-install.php');
			cy.wordPressDocument()
				.find('.plugin-card')
				.should('have.length.above', 4);
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
			cy.visit('/?url=/wp-admin/&networking=no');
			cy.wordpressPath().should('contain', '/wp-admin/');
			cy.wordPressDocument()
				.find('#adminmenu')
				.should('contain', 'Dashboard');
		});
	});

	describe('option `mode`', () => {
		it('lack of mode=seamless should a WordPress in a simulated browser UI', () => {
			cy.visit('/?networking=no');
			cy.get('[data-cy="simulated-browser"]').should('exist');
		});
		it('mode=seamless should load a fullscreen WordPress', () => {
			cy.visit('/?networking=no&mode=seamless');
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
});

describe('Playground import/export to zip', () => {
	it('should export a zipped wp-content directory when the "Download as .zip" button is clicked', () => {
		cy.visit('/?networking=no');
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

	it.only('should import a previously exported wp-content directory when the "Restore from .zip" feature is used', () => {
		cy.visit(
			'/?networking=no#{"siteOptions":{"blogname":"Cypress tests – site title"}}'
		);

		// Wait for the Playground to finish loading
		cy.wordPressDocument()
			.its('body')
			.should('contain', 'Cypress tests – site title');

		// Download a zip file
		cy.get('[data-cy="dropdown-menu"]').click();
		cy.get('[data-cy="download-as-zip"]').click();
		const downloadsFolder = Cypress.config('downloadsFolder');
		cy.readFile(downloadsFolder + '/wordpress-playground.zip').should(
			'have.length.above',
			1000
		);

		// Reload the page
		cy.visit('/?networking=no');
		cy.url().should('match', /\?networking=no$/);
		cy.get('input[name=url]').should('be.visible');
		cy.wordPressDocument()
			.its('body')
			.should('not.contain', 'Cypress tests – site title');

		// Import the zip file
		cy.get('[data-cy="dropdown-menu"]').click();
		cy.get('[data-cy="restore-from-zip"]').click();
		cy.get('#import-select-file').selectFile(
			downloadsFolder + '/wordpress-playground.zip'
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

describe('Playground website UI', () => {
	beforeEach(() => cy.visit('/?networking=no'));

	it('should reflect the URL update from the navigation bar in the WordPress site', () => {
		cy.setWordPressUrl('/wp-admin');
		cy.wordpressPath().should('contain', '/wp-admin');
	});

	// Test all PHP versions for completeness
	SupportedPHPVersions.forEach((version) => {
		it('should switch PHP version to ' + version, () => {
			// Update settings in Playground configurator
			cy.get('button#configurator').click();
			cy.get('select#php-version').select(version);
			cy.get('#modal-content button[type=submit]').click();
			// Wait for the page to finish reloading
			cy.url().should('contain', `&php=${version}`);
			cy.document().should('exist');

			// Go to phpinfo
			cy.setWordPressUrl('/phpinfo.php');
			cy.wordPressDocument()
				.find('h1')
				.should('contain', 'PHP Version ' + version);
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
			cy.wordPressDocument()
				.find('#footer-upgrade')
				.should('contain', versionMessage);
		});
	}
});
