import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '..';
import { defineWpConfigConsts } from '../define-wp-config-consts';

/** @ts-ignore */
import transportFetch from './wp-content/mu-plugins/playground-includes/wp_http_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './wp-content/mu-plugins/playground-includes/requests_transport_dummy.php?raw';
/** @ts-ignore */
import playgroundMuPlugin from './wp-content/mu-plugins/0-playground.php?raw';
import { updateFile } from '../../utils/update-file';
import { joinPaths } from '@php-wasm/util';

/**
 * @private
 */
export interface ApplyWordPressPatchesStep {
	step: 'applyWordPressPatches';
	siteUrl?: string;
	wordpressPath?: string;
	addPhpInfo?: boolean;
	patchSecrets?: boolean;
	disableSiteHealth?: boolean;
	disableWpNewBlogNotification?: boolean;
	prepareForRunningInsideWebBrowser?: boolean;
	addFetchNetworkTransport?: boolean;
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
	if (options.prepareForRunningInsideWebBrowser === true) {
		await patch.prepareForRunningInsideWebBrowser();
	}
	if (options.addFetchNetworkTransport === true) {
		await patch.addFetchNetworkTransport();
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
			joinPaths(this.wordpressPath, 'phpinfo.php'),
			'<?php phpinfo(); '
		);
	}

	async patchSiteUrl() {
		await defineWpConfigConsts(this.php, {
			consts: {
				WP_HOME: this.scopedSiteUrl,
				WP_SITEURL: this.scopedSiteUrl,
			},
		});
	}

	async patchSecrets() {
		await defineWpConfigConsts(this.php, {
			consts: {
				AUTH_KEY: randomString(40),
				SECURE_AUTH_KEY: randomString(40),
				LOGGED_IN_KEY: randomString(40),
				NONCE_KEY: randomString(40),
				AUTH_SALT: randomString(40),
				SECURE_AUTH_SALT: randomString(40),
				LOGGED_IN_SALT: randomString(40),
				NONCE_SALT: randomString(40),
			},
		});
	}

	async disableSiteHealth() {
		await updateFile(
			this.php,
			joinPaths(this.wordpressPath, 'wp-includes/default-filters.php'),
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
			joinPaths(this.wordpressPath, 'wp-config.php'),
			// The original version of this function crashes WASM PHP, let's define an empty one instead.
			(contents) =>
				`${contents} function wp_new_blog_notification(...$args){} `
		);
	}

	async prepareForRunningInsideWebBrowser() {
		// Various tweaks
		await this.php.mkdir(
			joinPaths(this.wordpressPath, 'wp-content/mu-plugins')
		);
		await this.php.writeFile(
			joinPaths(
				this.wordpressPath,
				'/wp-content/mu-plugins/0-playground.php'
			),
			playgroundMuPlugin
		);
		await this.php.mkdir(
			joinPaths(
				this.wordpressPath,
				`/wp-content/mu-plugins/playground-includes`
			)
		);
		await this.php.writeFile(
			joinPaths(
				this.wordpressPath,
				`/wp-content/mu-plugins/playground-includes/requests_transport_dummy.php`
			),
			transportDummy
		);
	}

	async addFetchNetworkTransport() {
		await defineWpConfigConsts(this.php, {
			consts: {
				USE_FETCH_FOR_REQUESTS: true,
			},
		});

		// Force the fsockopen and cUrl transports to report they don't work:
		const transports = [
			joinPaths(
				this.wordpressPath,
				`/wp-includes/Requests/Transport/fsockopen.php`
			),
			joinPaths(
				this.wordpressPath,
				`/wp-includes/Requests/Transport/cURL.php`
			),
			joinPaths(
				this.wordpressPath,
				`/wp-includes/Requests/src/Transport/Fsockopen.php`
			),
			joinPaths(
				this.wordpressPath,
				`/wp-includes/Requests/src/Transport/Curl.php`
			),
		];
		for (const transport of transports) {
			// One of the transports might not exist in the latest WordPress version.
			if (!(await this.php.fileExists(transport))) {
				continue;
			}
			await updateFile(this.php, transport, (contents) => {
				// If the transport is already patched, don't patch it again.
				if (contents.includes('public static function test2')) {
					return contents;
				}
				return contents.replace(
					'public static function test',
					'public static function test( $capabilities = array() ) { return false; } public static function test2'
				);
			});
		}

		// Add fetch and dummy transports for HTTP requests
		await this.php.writeFile(
			joinPaths(
				this.wordpressPath,
				'wp-content/mu-plugins/playground-includes/wp_http_fetch.php'
			),
			transportFetch
		);
		await this.php.mkdir(`${this.wordpressPath}/wp-content/fonts`);
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
