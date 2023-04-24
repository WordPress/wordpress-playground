import { UniversalPHP } from '@php-wasm/universal';
import { updateFile } from '../common';

export interface PatchOptions {
	siteUrl: string;
	wordpressPath?: string;
	patchSqlitePlugin?: boolean;
	addPhpInfo?: boolean;
	patchSiteUrl?: boolean;
	disableSiteHealth?: boolean;
	disableWpNewBlogNotification?: boolean;
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
		await updateFile(
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
		await updateFile(
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
		await updateFile(
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
		await updateFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			// The original version of this function crashes WASM PHP, let's define an empty one instead.
			(contents) =>
				`${contents} function wp_new_blog_notification(...$args){} `
		);
	}
}
