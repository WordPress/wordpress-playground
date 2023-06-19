import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '..';
import { updateFile } from '../common';
import { defineWpConfigConsts } from '../define-wp-config-consts';

export interface ApplyWordPressPatchesStep {
	step: 'applyWordPressPatches';
	siteUrl?: string;
	wordpressPath?: string;
	addPhpInfo?: boolean;
	patchSecrets?: boolean;
	disableSiteHealth?: boolean;
	disableWpNewBlogNotification?: boolean;
}

export const applyWordPressPatches: StepHandler<
	ApplyWordPressPatchesStep
> = async (php, options) => {
	const patch = new WordPressPatcher(
		php,
		options.wordpressPath || '/wordpress',
		options.siteUrl
	);

	if (options.addPhpInfo === true) {
		await patch.addPhpInfo();
	}
	if (options.siteUrl) {
		await patch.patchSiteUrl();
	}
	if (options.patchSecrets === true) {
		await patch.patchSecrets();
	}
	if (options.disableSiteHealth === true) {
		await patch.disableSiteHealth();
	}
	if (options.disableWpNewBlogNotification === true) {
		await patch.disableWpNewBlogNotification();
	}
};

class WordPressPatcher {
	php: UniversalPHP;
	scopedSiteUrl?: string;
	wordpressPath: string;

	constructor(
		php: UniversalPHP,
		wordpressPath: string,
		scopedSiteUrl?: string
	) {
		this.php = php;
		this.scopedSiteUrl = scopedSiteUrl;
		this.wordpressPath = wordpressPath;
	}

	async addPhpInfo() {
		await this.php.writeFile(
			`${this.wordpressPath}/phpinfo.php`,
			'<?php phpinfo(); '
		);
	}

	async patchSiteUrl() {
		await defineWpConfigConsts(this.php, {
			consts: {
				WP_HOME: this.scopedSiteUrl,
				WP_SITEURL: this.scopedSiteUrl,
			},
			virtualize: true,
		});
	}

	async patchSecrets() {
		await updateFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			(contents) =>
				`<?php
					define('AUTH_KEY',         '${randomString(40)}');
					define('SECURE_AUTH_KEY',  '${randomString(40)}');
					define('LOGGED_IN_KEY',    '${randomString(40)}');
					define('NONCE_KEY',        '${randomString(40)}');
					define('AUTH_SALT',        '${randomString(40)}');
					define('SECURE_AUTH_SALT', '${randomString(40)}');
					define('LOGGED_IN_SALT',   '${randomString(40)}');
					define('NONCE_SALT',       '${randomString(40)}');
				?>${contents.replaceAll("', 'put your unique phrase here'", "__', ''")}`
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

function randomString(length: number) {
	const chars =
		'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+=-[]/.,<>?';
	let result = '';
	for (let i = length; i > 0; --i)
		result += chars[Math.floor(Math.random() * chars.length)];
	return result;
}
