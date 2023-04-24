import type { PHP } from '@php-wasm/web';
import { DOCROOT } from '../config';

/** @ts-ignore */
import transportFetch from './wp-content/mu-plugins/includes/requests_transport_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './wp-content/mu-plugins/includes/requests_transport_dummy.php?raw';
/** @ts-ignore */
import addRequests from './wp-content/mu-plugins/add_requests_transport.php?raw';
/** @ts-ignore */
import showAdminCredentialsOnWpLogin from './wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php?raw';

export default function patchWordPress(php: PHP, scopedSiteUrl: string) {
	new WordPressPatcher(php, scopedSiteUrl).patch();
}

class WordPressPatcher {
	#php: PHP;
	#scopedSiteUrl: string;

	constructor(php: PHP, scopedSiteUrl: string) {
		this.#php = php;
		this.#scopedSiteUrl = scopedSiteUrl;
	}

	patch() {
		this.#php.writeFile(`${DOCROOT}/phpinfo.php`, '<?php phpinfo(); ');
		// Upstream change proposed in https://github.com/WordPress/sqlite-database-integration/pull/28:
		this.#patchFile(
			`/wordpress/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php`,
			(contents) => {
				return contents.replace(
					'if ( false === strtotime( $value ) )',
					'if ( $value === "0000-00-00 00:00:00" || false === strtotime( $value ) )'
				);
			}
		);

		this.#php.mkdirTree(`${DOCROOT}/wp-admin/images`);
		const missingSvgs = [
			`${DOCROOT}/wp-admin/images/about-header-about.svg`,
			`${DOCROOT}/wp-admin/images/dashboard-background.svg`,
		];
		for (const missingSvg of missingSvgs) {
			this.#php.writeFile(missingSvg, '');
		}
		this.patchSiteUrl();
		this.#disableSiteHealth();
		this.#disableWpNewBlogNotification();
		this.#replaceRequestsTransports();
	}
	patchSiteUrl() {
		this.#patchFile(
			`${DOCROOT}/wp-config.php`,
			(contents) =>
				`<?php
				if(!defined('WP_HOME')) {
					define('WP_HOME', "${this.#scopedSiteUrl}");
					define('WP_SITEURL', "${this.#scopedSiteUrl}");
				}
				?>${contents}`
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
	#patchFile(path: string, callback: (contents: string) => string) {
		this.#php.writeFile(path, callback(this.#php.readFileAsText(path)));
	}
}
