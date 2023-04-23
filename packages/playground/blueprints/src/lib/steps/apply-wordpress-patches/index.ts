import { UniversalPHP } from '@php-wasm/universal';
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

export async function applyWordPressPatches(
	php: UniversalPHP,
	options: PatchOptions
) {
	const patch = new WordPressPatcher(
		php,
		options.siteUrl,
		options.wordpressPath || '/wordpress'
	);

	if (options.patchSqlitePlugin !== false) {
		await patch.patchSqlitePlugin();
	}
	if (options.addPhpInfo !== false) {
		await patch.addPhpInfo();
	}
	if (options.patchSiteUrl !== false) {
		await patch.patchSiteUrl();
	}
	if (options.disableSiteHealth !== false) {
		await patch.disableSiteHealth();
	}
	if (options.disableWpNewBlogNotification !== false) {
		await patch.disableWpNewBlogNotification();
	}
	if (options.allowWpOrgHosts !== false) {
		await patch.allowWpOrgHosts();
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
