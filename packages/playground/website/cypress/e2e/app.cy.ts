import {
	SupportedPHPVersions,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';

// @ts-ignore
import * as SupportedWordPressVersions from '../../../remote/src/wordpress/wp-versions.json';

const LatestSupportedWordPressVersion = Object.keys(
	SupportedWordPressVersions
).filter((x) => !['nightly', 'beta'].includes(x))[0];

describe('Query API', () => {
	/*
	 Test this: 

## Available options

| Option                 | Default Value | Description                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`                  | `8.0`         | Loads the specified PHP version. Supported values: `5.6`, `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`, `latest`                                                                                                                                                                                                                                     |
| `wp`                   | `latest`      | Loads the specified WordPress version. Supported values: `5.9`, `6.0`, `6.1`, `6.2`, `6.3`, `latest`, `nightly`, `beta`                                                                                                                                                                                                                                        |
| `blueprint-url`        |               | The URL of the Blueprint that will be used to configure this Playground instance.                                                                                                                                                                                                                                                                              |
| `php-extension-bundle` |               | Loads a bundle of PHP extensions. Supported bundles: `kitchen-sink` (for gd, mbstring, iconv, libxml, xml, dom, simplexml, xmlreader, xmlwriter)                                                                                                                                                                                                               |
| `networking`           | `yes` or `no` | Enables or disables the networking support for Playground. Defaults to `yes`                                                                                                                                                                                                                                                                                   |
| `plugin`               |               | Installs the specified plugin. Use the plugin name from the plugins directory URL, e.g. for a URL like `https://wordpress.org/plugins/wp-lazy-loading/`, the plugin name would be `wp-lazy-loading`. You can pre-install multiple plugins by saying `plugin=coblocks&plugin=wp-lazy-loading&…`. Installing a plugin automatically logs the user in as an admin |
| `theme`                |               | Installs the specified theme. Use the theme name from the themes directory URL, e.g. for a URL like `https://wordpress.org/themes/disco/`, the theme name would be `disco`. Installing a theme automatically logs the user in as an admin                                                                                                                      |
| `url`                  | `/wp-admin/`  | Load the specified initial page displaying WordPress                                                                                                                                                                                                                                                                                                           |
| `mode`                 | `seamless`    | Displays WordPress on a full-page or wraps it in a browser UI                                                                                                                                                                                                                                                                                                  |
| `lazy`                 |               | Defer loading the Playground assets until someone clicks on the "Run" button                                                                                                                                                                                                                                                                                   |
| `login`                | `1`           | Logs the user in as an admin                                                                                                                                                                                                                                                                                                                                   |
| `storage`              |               | Selects the storage for Playground: `none` gets erased on page refresh, `browser` is stored in the browser, and `device` is stored in the selected directory on a device. The last two protect the user from accidentally losing their work upon page refresh.                                                                                                 |

For example, the following code embeds a Playground with a preinstalled Gutenberg plugin, and opens the post editor:

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```
	 */

	describe('option `php`', () => {
		it('should load PHP 8.0 by default', () => {
			cy.visit('/?url=/phpinfo.php');
			cy.inWordPressIframe(() => {
				cy.get('h1').should('contain', 'PHP Version 8.0');
			});
		});

		it('should load PHP 7.4 when requested', () => {
			cy.visit('/?php=7.4&url=/phpinfo.php');
			cy.inWordPressIframe(() => {
				cy.get('h1').should('contain', 'PHP Version 7.4');
			});
		});
	});

	describe('option `wp`', () => {
		it('should load WordPress latest by default', () => {
			cy.visit('/?url=/wp-admin');
			cy.inWordPressIframe(() => {
				cy.pause();
				cy.get(
					'body.branch-' +
						LatestSupportedWordPressVersion.replace('.', '-')
				).should('exist');
			});
		});

		it('should load WordPress 6.3 when requested', () => {
			cy.visit('/?wp=6.3&url=/wp-admin');
			cy.inWordPressIframe(() => {
				cy.get('body.branch-6-3').should('exist');
			});
		});
	});

	describe('option `php-extension-bundle`', () => {
		it('should load the specified PHP extensions', () => {
			cy.visit('/?php-extension-bundle=kitchen-sink&url=/phpinfo.php');
			cy.inWordPressIframe(() => {
				cy.get('td.v').should('contain', '--enable-xmlwriter');
			});
		});
	});

	describe('option `networking`', () => {
		it('should disable networking when requested', () => {
			cy.visit('/?networking=no&url=/wp-admin/plugin-install.php');
			cy.inWordPressIframe(() => {
				cy.get('.notice.error').should('exist');
				cy.get('.notice.error').should(
					'contain',
					'does not yet support connecting to the plugin directory'
				);
			});
		});

		it('should enable networking when requested', () => {
			cy.visit('/?networking=yes&url=/wp-admin/plugin-install.php');
			cy.inWordPressIframe(() => {
				cy.get('.plugin-card').should('exist');
				cy.get('.plugin-card').should('have.length.above', 4);
			});
		});
	});

	describe('option `plugin`', () => {
		it('should install the specified plugin', () => {
			cy.visit('/?plugin=gutenberg&url=/wp-admin/plugins.php');
			cy.inWordPressIframe(() => {
				cy.get('[data-slug=gutenberg].active').should('exist');
			});
		});
	});

	describe('option `theme`', () => {
		it('should install the specified theme', () => {
			cy.visit('/?theme=twentytwentyone&url=/wp-admin/themes.php');
			cy.inWordPressIframe(() => {
				cy.get('[data-slug=twentytwentyone].active').should('exist');
			});
		});
	});
});

describe('playground-website', () => {
	beforeEach(() => cy.visit('/?networking=no'));

	it('should reflect the URL update from the navigation bar in the WordPress site', () => {
		cy.setWordPressUrl('/wp-admin');
		cy.inRemoteIframe(() => {
			cy.get('iframe#wp')
				.should('have.attr', 'src')
				.and('match', /\/wp-admin\/?$/);
		});
	});

	// Test all PHP versions for completeness
	SupportedPHPVersions.forEach((version) => {
		it('should switch PHP version to ' + version, () => {
			// Update settings in Playground configurator
			cy.get('button#configurator').click();
			cy.get('select#php-version').select(version);
			cy.get('#modal-content button[type=submit]').click();
			// Wait for the page to finish loading
			cy.document().should('exist');

			// Go to phpinfo
			cy.setWordPressUrl('/phpinfo.php');
			cy.inWordPressIframe(() => {
				cy.get('h1').should('contain', 'PHP Version ' + version);
			});
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
		cy.inWordPressIframe(() => {
			cy.get('td.v').should('contain', '--enable-xmlwriter');
		});
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
		cy.inWordPressIframe(() => {
			cy.get('td.v').should('contain', '--without-libxml');
		});
	});

	// Test all WordPress versions for completeness
	for (const version in SupportedWordPressVersions) {
		if (version === 'beta') {
			continue;
		}
		// @ts-ignore
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
			cy.inWordPressIframe(() => {
				if (version === 'nightly') {
					cy.get('#footer-upgrade').should(
						'contan',
						'You are using a development version'
					);
				} else {
					cy.get('body.branch-' + version.replace('.', '-')).should(
						'exist'
					);
				}
			});
		});
	}
});
