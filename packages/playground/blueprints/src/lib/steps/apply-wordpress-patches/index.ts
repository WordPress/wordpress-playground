import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '..';
import { updateFile } from '../common';

export interface ApplyWordPressPatchesStep {
	step: 'applyWordPressPatches';
	siteUrl: string;
	wordpressPath?: string;
	patchSqlitePlugin?: boolean;
	addPhpInfo?: boolean;
	patchSiteUrl?: boolean;
	disableSiteHealth?: boolean;
	disableWpNewBlogNotification?: boolean;
}

export const applyWordPressPatches: StepHandler<
	ApplyWordPressPatchesStep
> = async (php, options) => {
	// @TODO: Only apply these patches once instead of
	//        using conditionals
	const wordpressPath = options.wordpressPath || '/wordpress';
	const patch = new WordPressPatcher(php, options.siteUrl, wordpressPath);
	if (options.patchSiteUrl !== false) {
		await patch.patchSiteUrl();
	}

	const alreadyPatched = await php.fileExists(
		`${wordpressPath}/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php`
	);
	if (alreadyPatched) {
		return;
	}

	if (options.patchSqlitePlugin !== false) {
		await patch.patchSqlitePlugin();
	}
	if (options.addPhpInfo !== false) {
		await patch.addPhpInfo();
	}
	if (options.disableSiteHealth !== false) {
		await patch.disableSiteHealth();
	}
	if (options.disableWpNewBlogNotification !== false) {
		await patch.disableWpNewBlogNotification();
	}
};

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
					define('AUTH_KEY',         'l{N0IT}H9l6CzcxomEJ{$5CI8D4|;u+DfhOTz6)BM5]+d-frKqkqeExVB},w^^(');
					define('SECURE_AUTH_KEY',  'dF:TnG~~J*z!;TM:wW;3 4ck+xThX~!y10n_of8QE+.cn29/6}W~b0AB,.vf&0M>');
					define('LOGGED_IN_KEY',    '2c@eia#1Oeh 3Ov%K>pkmfuB$L}l}g6V?4!+MY,Aq|!{R!,*wU.s~Ng!toK&d');
					define('NONCE_KEY',        'I(Y+k]-|W9b_TzU|j=dSUPJDp}^~E%fr(WbB~ -7b[yS)sI.#g.w+Wn IKve{Wy');
					define('AUTH_SALT',        '9XtjG=f4dOBR{rY-~|l>Tr:wzc*xti)p-P -|CW#>N2 -H~ll8Fg]sZf+,m&GA~[');
					define('SECURE_AUTH_SALT', '6]un+=or[6xH+{?1Oai@v0:573RHN/-C/U88$bw$I4&Xka{tm<O|M9%BU0Wkj8');
					define('LOGGED_IN_SALT',   'Si3bejgH+vqKV|j/uTCL0f8E:5g;@M-2036nP}UqKqnLASGi/+MsCvo|snrc<|f+');
					define('NONCE_SALT',       '[g-wXg=gXqS wof>Fj uxR)F~.C!I9b. U?;L^t&AOLH{E_?B& DU.4-C@+DM,');
				}
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
			(contents) => {
				// @TODO: Only apply this once instead of using a conditional
				if (contents.includes('wp_new_blog_notification')) {
					return contents;
				}
				return `${contents} function wp_new_blog_notification(...$args){} `;
			}
		);
	}
}
