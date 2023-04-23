import { UniversalPHP } from '@php-wasm/universal';

/** @ts-ignore */
import transportFetch from './wp-content/mu-plugins/includes/requests_transport_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './wp-content/mu-plugins/includes/requests_transport_dummy.php?raw';
/** @ts-ignore */
import addRequests from './wp-content/mu-plugins/add_requests_transport.php?raw';
/** @ts-ignore */
import showAdminCredentialsOnWpLogin from './wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php?raw';
import { patchFile } from '../common';

export interface PatchOptions {
	siteUrl: string;
	wordpressPath?: string;
	patchSqlitePlugin?: boolean;
	addPhpInfo?: boolean;
	patchSiteUrl?: boolean;
	disableSiteHealth?: boolean;
	disableWpNewBlogNotification?: boolean;
	replaceRequestsTransports?: boolean;
	allowWpOrgHosts?: boolean;
}

export function applyWordPressPatches(
	php: UniversalPHP,
	options: PatchOptions
) {
	const patch = new WordPressPatcher(
		php,
		options.siteUrl,
		options.wordpressPath || '/wordpress'
	);

	if (options.patchSqlitePlugin !== false) {
		patch.patchSqlitePlugin();
	}
	if (options.addPhpInfo !== false) {
		patch.addPhpInfo();
	}
	if (options.patchSiteUrl !== false) {
		patch.patchSiteUrl();
	}
	if (options.disableSiteHealth !== false) {
		patch.disableSiteHealth();
	}
	if (options.disableWpNewBlogNotification !== false) {
		patch.disableWpNewBlogNotification();
	}
	if (options.replaceRequestsTransports !== false) {
		patch.replaceRequestsTransports();
	}
	if (options.allowWpOrgHosts !== false) {
		patch.allowWpOrgHosts();
	}
}

class WordPressPatcher {
	php: UniversalPHP;
	scopedSiteUrl: string;
	wordpressPath: string;

	constructor(
		php: UniversalPHP,
		scopedSiteUrl: string,
		wordpressPath: string
	) {
		this.php = php;
		this.scopedSiteUrl = scopedSiteUrl;
		this.wordpressPath = wordpressPath;
	}

	async patchSqlitePlugin() {
		// Upstream change proposed in https://github.com/WordPress/sqlite-database-integration/pull/28:
		await patchFile(
			this.php,
			`${this.wordpressPath}/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php`,
			(contents) => {
				return contents.replace(
					'if ( false === strtotime( $value ) )',
					'if ( $value === "0000-00-00 00:00:00" || false === strtotime( $value ) )'
				);
			}
		);
	}

	async addPhpInfo() {
		await this.php.writeFile(
			`${this.wordpressPath}/phpinfo.php`,
			'<?php phpinfo(); '
		);
	}
	async patchSiteUrl() {
		await patchFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			(contents) =>
				`<?php
				if(!defined('WP_HOME')) {
					define('WP_HOME', "${this.scopedSiteUrl}");
					define('WP_SITEURL', "${this.scopedSiteUrl}");
				}
				?>${contents}`
		);
	}
	async disableSiteHealth() {
		await patchFile(
			this.php,
			`${this.wordpressPath}/wp-includes/default-filters.php`,
			(contents) =>
				contents.replace(
					/add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;/i,
					''
				)
		);
	}
	async disableWpNewBlogNotification() {
		await patchFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			// The original version of this function crashes WASM WordPress, let's define an empty one instead.
			(contents) =>
				`${contents} function wp_new_blog_notification(...$args){} `
		);
	}
	async replaceRequestsTransports() {
		await patchFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			(contents) => `${contents} define('USE_FETCH_FOR_REQUESTS', false);`
		);

		// Force the fsockopen and cUrl transports to report they don't work:
		const transports = [
			`${this.wordpressPath}/wp-includes/Requests/Transport/fsockopen.php`,
			`${this.wordpressPath}/wp-includes/Requests/Transport/cURL.php`,
		];
		for (const transport of transports) {
			// One of the transports might not exist in the latest WordPress version.
			if (!(await this.php.fileExists(transport))) {
				continue;
			}
			await patchFile(this.php, transport, (contents) =>
				contents.replace(
					'public static function test',
					'public static function test( $capabilities = array() ) { return false; } public static function test2'
				)
			);
		}

		// Add fetch and dummy transports for HTTP requests
		await this.php.mkdirTree(
			`${this.wordpressPath}/wp-content/mu-plugins/includes`
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/includes/requests_transport_fetch.php`,
			transportFetch
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/includes/requests_transport_dummy.php`,
			transportDummy
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/add_requests_transport.php`,
			addRequests
		);

		// Various tweaks
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php`,
			showAdminCredentialsOnWpLogin
		);
	}

	async addMissingSvgs() {
		// @TODO: use only on the web version, or not even there – just include these
		// in WordPress build:
		this.php.mkdirTree(`${this.wordpressPath}/wp-admin/images`);
		const missingSvgs = [
			`${this.wordpressPath}/wp-admin/images/about-header-about.svg`,
			`${this.wordpressPath}/wp-admin/images/dashboard-background.svg`,
		];
		for (const missingSvg of missingSvgs) {
			if (!(await this.php.fileExists(missingSvg))) {
				await this.php.writeFile(missingSvg, '');
			}
		}
	}

	async allowWpOrgHosts() {
		await this.php.mkdirTree(`${this.wordpressPath}/wp-content/mu-plugins`);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/0-allow-wp-org.php`,
			`<?php
			// Needed because gethostbyname( 'wordpress.org' ) returns
			// a private network IP address for some reason.
			add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
				return array( 
					'wordpress.org',
					'api.wordpress.org',
					'downloads.wordpress.org',
				);
			} );`
		);
	}
}
