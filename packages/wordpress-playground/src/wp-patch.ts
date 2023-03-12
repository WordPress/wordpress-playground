import type { PHP } from '@wordpress/php-wasm';
import { DOCROOT } from './config';

// @ts-ignore
import transportFetch from './mu-plugins/includes/requests_transport_fetch.php?raw';
// @ts-ignore
import transportDummy from './mu-plugins/includes/requests_transport_dummy.php?raw';
// @ts-ignore
import addRequests from './mu-plugins/add_requests_transport.php?raw';
// @ts-ignore
import showAdminCredentialsOnWpLogin from './mu-plugins/1-show-admin-credentials-on-wp-login.php?raw';

export default function patchWordPress(php: PHP, scopedSiteUrl: string) {
    new WordPressPatcher(php, scopedSiteUrl).patch();
}

class WordPressPatcher {
	
	#php: PHP;
    #scopedSiteUrl: string;
    
	constructor(php, scopedSiteUrl) {
		this.#php = php;
		this.#scopedSiteUrl = scopedSiteUrl;
	}

	patch() {
		this.#php.writeFile('/wordpress/phpinfo.php', '<?php phpinfo(); ');
		this.#adjustPathsAndUrls();
		this.#disableSiteHealth();
		this.#disableWpNewBlogNotification();
		this.#replaceRequestsTransports();
	}
	#adjustPathsAndUrls() {
		this.#patchFile(
			`${DOCROOT}/wp-config.php`,
			(contents) =>
				`${contents} define('WP_HOME', '${JSON.stringify(DOCROOT)}');`
		);

		// Force the site URL to be $scopedSiteUrl:
		// Interestingly, it doesn't work when put in a mu-plugin.
		this.#patchFile(
			`${DOCROOT}/wp-includes/plugin.php`,
			(contents) =>
				contents +
				`
				function _wasm_wp_force_site_url() {
					return ${JSON.stringify(this.#scopedSiteUrl)};
				}
				add_filter( "option_home", '_wasm_wp_force_site_url', 10000 );
				add_filter( "option_siteurl", '_wasm_wp_force_site_url', 10000 );
			`
		);
	}
	#disableSiteHealth() {
		this.#patchFile(
			`${DOCROOT}/wp-includes/default-filters.php`,
			(contents) =>
				contents.replace(
					/add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;/i,
					''
				)
		);
	}
	#disableWpNewBlogNotification() {
		this.#patchFile(
			`${DOCROOT}/wp-config.php`,
			// The original version of this function crashes WASM WordPress, let's define an empty one instead.
			(contents) =>
				`${contents} function wp_new_blog_notification(...$args){} `
		);
	}
	#replaceRequestsTransports() {
		this.#patchFile(
			`${DOCROOT}/wp-config.php`,
			(contents) => `${contents} define('USE_FETCH_FOR_REQUESTS', false);`
		);

		// Force the fsockopen and cUrl transports to report they don't work:
		const transports = [
			`${DOCROOT}/wp-includes/Requests/Transport/fsockopen.php`,
			`${DOCROOT}/wp-includes/Requests/Transport/cURL.php`,
		];
		for (const transport of transports) {
			// One of the transports might not exist in the latest WordPress version.
			if (!this.#php.fileExists(transport)) continue;
			this.#patchFile(transport, (contents) =>
				contents.replace(
					'public static function test',
					'public static function test( $capabilities = array() ) { return false; } public static function test2'
				)
			);
		}

		// Add fetch and dummy transports for HTTP requests
		this.#php.mkdirTree(`${DOCROOT}/wp-content/mu-plugins/includes`);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/includes/requests_transport_fetch.php`,
			transportFetch
		);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/includes/requests_transport_dummy.php`,
			transportDummy
		);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/add_requests_transport.php`,
			addRequests
		);

		// Various tweaks
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php`,
			showAdminCredentialsOnWpLogin
		);		
	}
	#patchFile(path, callback) {
		this.#php.writeFile(path, callback(this.#php.readFileAsText(path)));
	}
}
